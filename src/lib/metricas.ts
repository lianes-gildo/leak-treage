import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@/lib/supabase-browser'
import { serverStore } from '@/lib/server-store'
import { FeedbackValidacao, Prioridade, FontesDadosMap } from '@/types/ocorrencia'

export interface MetricasQualidade {
  total: number
  concordancia_geral: number // percentual (0-100)
  falsos_negativos_p1: number // engine disse P2+ mas operador corrigiu para P1 — a métrica mais crítica
  concordancia_por_fonte: Record<string, number>
}

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createBrowserClient()
  }
  try {
    return createServiceClient()
  } catch {
    return createBrowserClient()
  }
}

/**
 * Grava o registro de feedback da validação humana na tabela `feedback_validacao`.
 */
export async function registrarFeedbackValidacao(payload: {
  ocorrencia_id: string
  prioridade_sugerida: Prioridade
  prioridade_confirmada: Prioridade
  fontes_dados?: FontesDadosMap | null
  validado_por?: string | null
}): Promise<boolean> {
  const concordou = payload.prioridade_sugerida === payload.prioridade_confirmada

  // 1. Grava no store resiliente em memória
  serverStore.adicionarFeedback({
    ocorrencia_id: payload.ocorrencia_id,
    prioridade_sugerida: payload.prioridade_sugerida,
    prioridade_confirmada: payload.prioridade_confirmada,
    concordou,
    fontes_dados: payload.fontes_dados || null,
    validado_por: payload.validado_por || 'operador_anonimo',
  })

  // 2. Tenta persistir no Supabase com circuit breaker
  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = getSupabaseClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )
      const insertPromise = supabase.from('feedback_validacao').insert([
        {
          ocorrencia_id: payload.ocorrencia_id,
          prioridade_sugerida: payload.prioridade_sugerida,
          prioridade_confirmada: payload.prioridade_confirmada,
          concordou,
          fontes_dados: payload.fontes_dados || null,
          validado_por: payload.validado_por || 'operador_anonimo',
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

  return true
}

/**
 * Calcula métricas de qualidade do modelo e concordância com os operadores num determinado período.
 */
export async function calcularTaxaAcerto(
  periodo: { inicio: Date; fim: Date },
  mockFeedbackStoreOpcional?: FeedbackValidacao[]
): Promise<MetricasQualidade> {
  let feedbacks: FeedbackValidacao[] = []

  if (mockFeedbackStoreOpcional) {
    feedbacks = mockFeedbackStoreOpcional.filter((f) => {
      const d = new Date(f.criado_em)
      return d >= periodo.inicio && d <= periodo.fim
    })
  } else {
    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = getSupabaseClient()
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const fetchPromise = supabase
          .from('feedback_validacao')
          .select('*')
          .gte('criado_em', periodo.inicio.toISOString())
          .lte('criado_em', periodo.fim.toISOString())

        const res = await Promise.race([fetchPromise, timeoutPromise])
        if ('data' in res && res.data && res.data.length > 0) {
          feedbacks = res.data as FeedbackValidacao[]
          serverStore.recordSupabaseSuccess()
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    if (feedbacks.length === 0) {
      feedbacks = serverStore.listarFeedbacks(periodo.inicio, periodo.fim)
    }
  }

  const total = feedbacks.length
  if (total === 0) {
    return {
      total: 0,
      concordancia_geral: 0,
      falsos_negativos_p1: 0,
      concordancia_por_fonte: { gis: 0, gemini: 0 },
    }
  }

  let concordantes = 0
  let falsosNegativosP1 = 0

  let gisTotal = 0
  let gisConcordantes = 0
  let geminiTotal = 0
  let geminiConcordantes = 0

  for (const f of feedbacks) {
    if (f.concordou) {
      concordantes++
    }

    // Falso negativo P1: o engine disse P2, P3, P4 ou P5, mas o operador corrigiu para P1
    if (f.prioridade_sugerida !== 'P1' && f.prioridade_confirmada === 'P1') {
      falsosNegativosP1++
    }

    // Análise por fonte de dados (GIS vs Gemini)
    if (f.fontes_dados) {
      const fonteInfra = f.fontes_dados.infraestrutura
      if (fonteInfra === 'gis') {
        gisTotal++
        if (f.concordou) gisConcordantes++
      } else {
        geminiTotal++
        if (f.concordou) geminiConcordantes++
      }
    }
  }

  const concordanciaGeral = Math.round((concordantes / total) * 100)
  const taxaGis = gisTotal > 0 ? Math.round((gisConcordantes / gisTotal) * 100) : 0
  const taxaGemini = geminiTotal > 0 ? Math.round((geminiConcordantes / geminiTotal) * 100) : 0

  return {
    total,
    concordancia_geral: concordanciaGeral,
    falsos_negativos_p1: falsosNegativosP1,
    concordancia_por_fonte: {
      gis: taxaGis,
      gemini: taxaGemini,
    },
  }
}
