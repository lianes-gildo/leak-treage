import { EventoAuditoria } from '@/lib/auditoria'
import { Notificacao, PapelUsuario, TipoNotificacao } from '@/types/ocorrencia'
import { createServiceClient } from '@/lib/supabase-server'

export interface NotificacaoPendente {
  destinatario_id?: string | null
  papel_alvo?: PapelUsuario | null
  ocorrencia_id?: string | null
  grupo_id?: string | null
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
}

export const JANELA_THROTTLING_NOTIFICACAO_MINUTOS = 15

/**
 * Função pura que avalia um evento do sistema e decide quais notificações devem ser geradas.
 */
export function decidirNotificacoes(evento: EventoAuditoria): NotificacaoPendente[] {
  const notificacoes: NotificacaoPendente[] = []
  const { tipo_evento, ocorrencia_id, valor_novo, motivo } = evento

  // Regra 1: Nova ocorrência com despacho urgente (Fila Urgente ou P1/P2)
  if (
    tipo_evento === 'classificacao_inicial' &&
    (valor_novo?.decisao_despacho?.acao === 'fila_urgente_humana' ||
      valor_novo?.prioridade === 'P1' ||
      valor_novo?.prioridade === 'P2')
  ) {
    notificacoes.push(
      {
        papel_alvo: 'operador',
        ocorrencia_id,
        grupo_id: valor_novo?.grupo_id || null,
        tipo: 'nova_urgente',
        titulo: `Nova Ocorrência Urgente [${valor_novo?.prioridade || 'P1'}]`,
        mensagem: `Ocorrência ${ocorrencia_id.substring(0, 8)} requer triagem urgente. Motivo: ${motivo}`,
      },
      {
        papel_alvo: 'supervisor',
        ocorrencia_id,
        grupo_id: valor_novo?.grupo_id || null,
        tipo: 'nova_urgente',
        titulo: `Supervisão: Alerta de Fuga Urgente [${valor_novo?.prioridade || 'P1'}]`,
        mensagem: `Nova fuga crítica detetada (${ocorrencia_id.substring(0, 8)}).`,
      }
    )
  }

  // Regra 2: Escalonamento por SLA que resultar em P1 ou P2
  if (
    tipo_evento === 'escalonamento_sla' &&
    (valor_novo?.prioridade === 'P1' || valor_novo?.prioridade === 'P2')
  ) {
    notificacoes.push({
      papel_alvo: 'supervisor',
      ocorrencia_id,
      tipo: 'escalonada',
      titulo: `Alerta de SLA Vencido [${valor_novo?.prioridade}]`,
      mensagem: `Ocorrência ${ocorrencia_id.substring(0, 8)} ultrapassou o SLA e foi escalonada para ${valor_novo?.prioridade}.`,
    })
  }

  // Regra 3: Grupo amplificado cruzando o piso de P1 (quantidade_reportes >= 10 ou prioridade P1)
  if (
    tipo_evento === 'amplificacao_grupo' &&
    ((valor_novo?.quantidade_reportes != null && valor_novo.quantidade_reportes >= 10) ||
      valor_novo?.prioridade === 'P1')
  ) {
    notificacoes.push({
      papel_alvo: 'supervisor',
      grupo_id: valor_novo?.grupo_id || null,
      ocorrencia_id,
      tipo: 'grupo_amplificado',
      titulo: `Incidente de Grande Escala (Grupo P1 - ${valor_novo?.quantidade_reportes || 10}+ Reportes)`,
      mensagem: `Possível rutura de grande conduta. ${valor_novo?.quantidade_reportes || 10} cidadãos reportaram a mesma fuga.`,
    })
  }

  // Regra 4: Ocorrência atribuída a uma equipa técnica
  if (tipo_evento === 'atribuicao_equipa') {
    notificacoes.push({
      papel_alvo: 'operador',
      ocorrencia_id,
      tipo: 'atribuicao_pendente',
      titulo: `Nova Atribuição de Equipa`,
      mensagem: `Equipa '${valor_novo?.equipa_atribuida}' atribuída à ocorrência ${ocorrencia_id.substring(0, 8)}.`,
    })
  }

  return notificacoes
}

/**
 * Regra de supressão (throttling):
 * Evita fadiga de alertas. Se já existir uma notificação NÃO LIDA do mesmo tipo para o mesmo alvo nos últimos 15 minutos, suprime.
 * Se a notificação anterior já foi LIDA (lida === true), permite criar uma nova imediatamente.
 */
export function verificarThrottlingNotificacao(
  tipo: TipoNotificacao,
  targetId: string,
  historicoNotificacoes: Notificacao[]
): boolean {
  if (!historicoNotificacoes || historicoNotificacoes.length === 0) return false

  const agora = new Date()
  const dataLimite = new Date(agora.getTime() - JANELA_THROTTLING_NOTIFICACAO_MINUTOS * 60 * 1000)

  return historicoNotificacoes.some((n) => {
    if (n.tipo !== tipo) return false
    if (n.lida) return false // Se já foi lida, NÃO suprime!

    const mesmolocal = n.grupo_id === targetId || n.ocorrencia_id === targetId
    if (!mesmolocal) return false

    return new Date(n.criado_em) >= dataLimite
  })
}

/**
 * Processa um evento de auditoria, gera as notificações necessárias, aplica throttling e persiste no Supabase.
 * ISOLAMENTO DE FALHAS: Em caso de erro na gravação, NUNCA derruba o fluxo principal.
 */
export async function processarERegistarNotificacoes(
  evento: EventoAuditoria,
  mockStoreNotificacoes?: Notificacao[]
): Promise<boolean> {
  try {
    const pendentes = decidirNotificacoes(evento)
    if (pendentes.length === 0) return true

    for (const p of pendentes) {
      const targetId = p.grupo_id || p.ocorrencia_id || ''

      if (mockStoreNotificacoes) {
        const suprimir = verificarThrottlingNotificacao(p.tipo, targetId, mockStoreNotificacoes)
        if (!suprimir) {
          mockStoreNotificacoes.push({
            id: `notif-${mockStoreNotificacoes.length + 1}`,
            destinatario_id: p.destinatario_id || null,
            papel_alvo: p.papel_alvo || null,
            ocorrencia_id: p.ocorrencia_id || null,
            grupo_id: p.grupo_id || null,
            tipo: p.tipo,
            titulo: p.titulo,
            mensagem: p.mensagem,
            lida: false,
            criado_em: new Date().toISOString(),
          })
        }
        continue
      }

      // Persistência real no Supabase com isolamento de erros e verificação de throttling
      try {
        const supabase = createServiceClient()
        const agora = new Date()
        const dataLimite = new Date(agora.getTime() - JANELA_THROTTLING_NOTIFICACAO_MINUTOS * 60 * 1000)

        // Verifica no banco se já existe notificação não lida recente para o mesmo tipo e alvo
        const { data: existentes } = await supabase
          .from('notificacoes')
          .select('id, grupo_id, ocorrencia_id, tipo, lida, criado_em')
          .eq('tipo', p.tipo)
          .eq('lida', false)
          .gte('criado_em', dataLimite.toISOString())

        const ehSuprimida = (existentes || []).some(
          (n) => n.grupo_id === targetId || n.ocorrencia_id === targetId
        )

        if (ehSuprimida) {
          continue
        }

        await supabase.from('notificacoes').insert([
          {
            destinatario_id: p.destinatario_id || null,
            papel_alvo: p.papel_alvo || null,
            ocorrencia_id: p.ocorrencia_id || null,
            grupo_id: p.grupo_id || null,
            tipo: p.tipo,
            titulo: p.titulo,
            mensagem: p.mensagem,
          },
        ])
      } catch (errDb: unknown) {
        const msg = errDb instanceof Error ? errDb.message : String(errDb)
        console.error('Falha isolada ao gravar notificação (fluxo principal continua):', msg)
      }
    }

    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Erro no motor de notificações (isolado):', msg)
    return false
  }
}
