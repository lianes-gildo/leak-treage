import { createServiceClient } from '@/lib/supabase-server'
import { serverStore } from '@/lib/server-store'
import { AuditoriaOcorrencia, TipoEventoAuditoria } from '@/types/ocorrencia'

export interface ValorEventoAuditoria {
  prioridade?: string | null
  status?: string | null
  score?: number | null
  grupo_id?: string | null
  quantidade_reportes?: number | null
  equipa_atribuida?: string | null
  decisao_despacho?: { acao: string; motivo?: string } | null
  sla_limite?: string | null
  [key: string]: unknown
}

export interface EventoAuditoria {
  ocorrencia_id: string
  tipo_evento: TipoEventoAuditoria
  valor_anterior?: ValorEventoAuditoria | null
  valor_novo?: ValorEventoAuditoria | null
  motivo: string
  autor?: string
}

/**
 * Função utilitária única para registrar eventos na trilha auditável `auditoria_ocorrencia`.
 */
export async function registrarEvento(
  evento: EventoAuditoria,
  mockAuditStoreOpcional?: AuditoriaOcorrencia[]
): Promise<boolean> {
  const {
    ocorrencia_id,
    tipo_evento,
    valor_anterior = null,
    valor_novo = null,
    motivo,
    autor = 'sistema',
  } = evento

  if (mockAuditStoreOpcional) {
    const novoRegistro: AuditoriaOcorrencia = {
      id: `audit-${mockAuditStoreOpcional.length + 1}`,
      ocorrencia_id,
      tipo_evento,
      valor_anterior,
      valor_novo,
      motivo,
      autor,
      criado_em: new Date().toISOString(),
    }
    mockAuditStoreOpcional.push(novoRegistro)
    return true
  }

  // 1. Grava sempre no store resiliente do servidor
  serverStore.adicionarAuditoria({
    ocorrencia_id,
    tipo_evento,
    valor_anterior: valor_anterior as Record<string, unknown> | null,
    valor_novo: valor_novo as Record<string, unknown> | null,
    motivo,
    autor: autor || 'sistema',
  })

  // 2. Tenta persistir no Supabase se disponível
  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )
      const insertPromise = supabase.from('auditoria_ocorrencia').insert([
        {
          ocorrencia_id,
          tipo_evento,
          valor_anterior,
          valor_novo,
          motivo,
          autor,
        },
      ])

      const res = await Promise.race([insertPromise, timeoutPromise])
      if ('error' in res && res.error) {
        serverStore.recordSupabaseFailure()
      } else {
        serverStore.recordSupabaseSuccess()
      }
    } catch {
      serverStore.recordSupabaseFailure()
    }
  }

  // 3. Dispara motor de notificações isoladamente
  try {
    const { processarERegistarNotificacoes } = await import('@/lib/notificacao-engine')
    processarERegistarNotificacoes(evento).catch((nErr) =>
      console.error('Erro assíncrono ao gerar notificação:', nErr)
    )
  } catch {
    // Ignora falhas no módulo de notificação
  }

  return true
}
