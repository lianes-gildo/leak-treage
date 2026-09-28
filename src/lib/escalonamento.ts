import { createServiceClient } from '@/lib/supabase-server'
import { Ocorrencia, Prioridade } from '@/types/ocorrencia'

/**
 * Tabela de SLA (em horas) por Prioridade.
 */
export const HORAS_SLA_POR_PRIORIDADE: Record<Prioridade, number> = {
  P1: 0, // Imediato (já nasce vencido/urgente)
  P2: 2,
  P3: 8,
  P4: 24,
  P5: 48,
}

/**
 * Calcula a data/hora limite do SLA a partir da data de criação e prioridade.
 */
export function calcularSLALimite(prioridade: Prioridade, dataCriacao: Date = new Date()): Date {
  const horas = HORAS_SLA_POR_PRIORIDADE[prioridade] ?? 24
  return new Date(dataCriacao.getTime() + horas * 60 * 60 * 1000)
}

/**
 * Promove a prioridade um nível acima (ex: P3 -> P2). P1 permanece P1.
 */
export function obterPrioridadeEscalonada(prioridadeAtual: Prioridade): Prioridade {
  switch (prioridadeAtual) {
    case 'P5':
      return 'P4'
    case 'P4':
      return 'P3'
    case 'P3':
      return 'P2'
    case 'P2':
      return 'P1'
    case 'P1':
    default:
      return 'P1'
  }
}

/**
 * Procura e escalona ocorrências cujo SLA limite já tenha sido ultrapassado.
 */
export async function escalonarOcorrenciasVencidas(
  ocorrenciasMockOpcional?: Ocorrencia[]
): Promise<{ escalonadas: number; logs: string[] }> {
  const agora = new Date()
  const logs: string[] = []

  let vencidas: Ocorrencia[] = []

  if (ocorrenciasMockOpcional) {
    vencidas = ocorrenciasMockOpcional.filter((o) => {
      if (o.escalonada || !o.sla_limite) return false
      if (o.status !== 'pendente' && o.status !== 'em_validacao') return false
      return new Date(o.sla_limite) <= agora
    })
  } else {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .in('status', ['pendente', 'em_validacao'])
        .eq('escalonada', false)
        .lte('sla_limite', agora.toISOString())

      if (error || !data) {
        console.error('Erro ao procurar ocorrências com SLA vencido:', error?.message)
        return { escalonadas: 0, logs }
      }
      vencidas = data as Ocorrencia[]
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Falha de ligação ao verificar SLA:', msg)
      return { escalonadas: 0, logs }
    }
  }

  let totalEscalonadas = 0

  for (const oc of vencidas) {
    const prioridadeAtual = oc.prioridade || 'P3'

    if (prioridadeAtual === 'P1') {
      const logMsg = `Ocorrência ${oc.id.substring(0, 8)} [P1] ultrapassou o SLA mas já se encontra no topo da prioridade.`
      logs.push(logMsg)
      console.log(`[Escalonamento SLA] ${logMsg}`)
      continue
    }

    const novaPrioridade = obterPrioridadeEscalonada(prioridadeAtual)
    const novoSLA = calcularSLALimite(novaPrioridade, agora)
    const logMsg = `SLA vencido — escalonada automaticamente de ${prioridadeAtual} para ${novaPrioridade}.`
    logs.push(`Ocorrência ${oc.id.substring(0, 8)}: ${logMsg}`)

    // Regista na trilha de auditoria
    try {
      const { registrarEvento } = await import('@/lib/auditoria')
      await registrarEvento({
        ocorrencia_id: oc.id,
        tipo_evento: 'escalonamento_sla',
        valor_anterior: { prioridade: prioridadeAtual, sla_limite: oc.sla_limite },
        valor_novo: { prioridade: novaPrioridade, sla_limite: novoSLA.toISOString() },
        motivo: logMsg,
        autor: 'sistema',
      })
    } catch (auditErr) {
      console.error('Falha ao registar auditoria de SLA:', auditErr)
    }

    if (!ocorrenciasMockOpcional) {
      const supabase = createServiceClient()
      await supabase
        .from('ocorrencias')
        .update({
          prioridade_original: oc.prioridade_original || prioridadeAtual,
          prioridade: novaPrioridade,
          escalonada: true,
          sla_limite: novoSLA.toISOString(),
          atualizado_em: agora.toISOString(),
        })
        .eq('id', oc.id)
    } else {
      oc.prioridade_original = oc.prioridade_original || prioridadeAtual
      oc.prioridade = novaPrioridade
      oc.escalonada = true
      oc.sla_limite = novoSLA.toISOString()
    }

    totalEscalonadas++
  }

  return { escalonadas: totalEscalonadas, logs }
}
