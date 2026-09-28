import { describe, it } from 'node:test'
import assert from 'node:assert'
import { calcularPrioridade } from './priority-engine'
import { PriorityInput } from '@/types/ocorrencia'

describe('Priority Engine Unit Tests', () => {
  it('deve forçar P1 por override de risco crítico (risco = 5)', () => {
    const input: PriorityInput = {
      infraestrutura: 1,
      diametro: 1,
      caudal: 1,
      impacto: 1,
      risco: 5,
      confidence: 0.95,
    }

    const result = calcularPrioridade(input)

    assert.strictEqual(result.prioridade, 'P1')
    assert.strictEqual(result.necessita_validacao_humana, true) // P1 requer validação humana
    assert.match(result.motivo, /Risco crítico/)
  })

  it('deve forçar P1 por override de conduta principal com caudal elevado (infraestrutura = 5, caudal = 4)', () => {
    const input: PriorityInput = {
      infraestrutura: 5,
      diametro: 2,
      caudal: 4,
      impacto: 2,
      risco: 2,
      confidence: 0.9,
    }

    const result = calcularPrioridade(input)

    assert.strictEqual(result.prioridade, 'P1')
    assert.strictEqual(result.necessita_validacao_humana, true)
    assert.match(result.motivo, /Fuga na conduta principal/)
  })

  it('deve calcular P5 para ocorrência de baixíssimo impacto e sem risco', () => {
    const input: PriorityInput = {
      infraestrutura: 1,
      diametro: 1,
      caudal: 1,
      impacto: 1,
      risco: 1,
      confidence: 0.9,
    }

    const result = calcularPrioridade(input)

    assert.strictEqual(result.score, 0)
    assert.strictEqual(result.prioridade, 'P5')
    assert.strictEqual(result.necessita_validacao_humana, false)
  })

  it('deve forçar necessita_validacao_humana = true quando confidence < 0.5', () => {
    const input: PriorityInput = {
      infraestrutura: 3,
      diametro: 3,
      caudal: 3,
      impacto: 3,
      risco: 3,
      confidence: 0.4, // Baixa confiança
    }

    const result = calcularPrioridade(input)

    assert.strictEqual(result.score, 50)
    assert.strictEqual(result.prioridade, 'P3')
    assert.strictEqual(result.necessita_validacao_humana, true)
    assert.match(result.motivo, /baixa confiança da IA/)
  })

  it('deve calcular P3 para uma ocorrência com score na faixa de 50 pontos', () => {
    const input: PriorityInput = {
      infraestrutura: 3,
      diametro: 3,
      caudal: 3,
      impacto: 3,
      risco: 3,
      confidence: 0.85,
    }

    const result = calcularPrioridade(input)

    assert.strictEqual(result.score, 50)
    assert.strictEqual(result.prioridade, 'P3')
    assert.strictEqual(result.necessita_validacao_humana, false)
  })
})
