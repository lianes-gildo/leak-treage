import { describe, it } from 'node:test'
import assert from 'node:assert'
import { calcularTaxaAcerto } from './metricas'
import { FeedbackValidacao } from '@/types/ocorrencia'

describe('Feedback & Quality Metrics Tests', () => {
  it('deve calcular corretamente a concordância geral e os falsos negativos P1', async () => {
    const agora = new Date()
    const inicio = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
    const fim = new Date(agora.getTime() + 24 * 60 * 60 * 1000)

    const mockFeedbacks: FeedbackValidacao[] = [
      {
        id: 'fb-1',
        ocorrencia_id: 'oc-1',
        prioridade_sugerida: 'P1',
        prioridade_confirmada: 'P1',
        concordou: true,
        fontes_dados: { infraestrutura: 'gis', diametro: 'gis', caudal: 'gemini', impacto: 'gemini', risco: 'gemini' },
        validado_por: 'op1',
        criado_em: agora.toISOString(),
      },
      {
        id: 'fb-2',
        ocorrencia_id: 'oc-2',
        prioridade_sugerida: 'P3',
        prioridade_confirmada: 'P1', // Falso negativo P1! (Engine disse P3, operador corrigiu para P1)
        concordou: false,
        fontes_dados: { infraestrutura: 'gemini', diametro: 'gemini', caudal: 'gemini', impacto: 'gemini', risco: 'gemini' },
        validado_por: 'op2',
        criado_em: agora.toISOString(),
      },
      {
        id: 'fb-3',
        ocorrencia_id: 'oc-3',
        prioridade_sugerida: 'P2',
        prioridade_confirmada: 'P2',
        concordou: true,
        fontes_dados: { infraestrutura: 'gis', diametro: 'gis', caudal: 'gemini', impacto: 'gemini', risco: 'gemini' },
        validado_por: 'op1',
        criado_em: agora.toISOString(),
      },
      {
        id: 'fb-4',
        ocorrencia_id: 'oc-4',
        prioridade_sugerida: 'P4',
        prioridade_confirmada: 'P4',
        concordou: true,
        fontes_dados: { infraestrutura: 'gemini', diametro: 'gemini', caudal: 'gemini', impacto: 'gemini', risco: 'gemini' },
        validado_por: 'op3',
        criado_em: agora.toISOString(),
      },
    ]

    const metricas = await calcularTaxaAcerto({ inicio, fim }, mockFeedbacks)

    assert.strictEqual(metricas.total, 4)
    assert.strictEqual(metricas.concordancia_geral, 75) // 3 em 4 = 75%
    assert.strictEqual(metricas.falsos_negativos_p1, 1) // 1 falso negativo
    assert.strictEqual(metricas.concordancia_por_fonte.gis, 100) // 2 de 2 com GIS concordaram
    assert.strictEqual(metricas.concordancia_por_fonte.gemini, 50) // 1 de 2 com Gemini concordou
  })
})
