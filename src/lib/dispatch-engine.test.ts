import { describe, it } from 'node:test'
import assert from 'node:assert'
import { decidirDespacho } from './dispatch-engine'

describe('Dispatch Decision Engine Tests', () => {
  it('Regra 1: deve encaminhar para fila_urgente_humana quando necessita_validacao_humana = true e prioridade = P1 ou P2', () => {
    const resP1 = decidirDespacho({
      prioridade: 'P1',
      necessita_validacao_humana: true,
      confidence: 0.95,
    })

    assert.strictEqual(resP1.acao, 'fila_urgente_humana')
    assert.match(resP1.motivo, /alta gravidade/)

    const resP2 = decidirDespacho({
      prioridade: 'P2',
      necessita_validacao_humana: true,
      confidence: 0.8,
    })

    assert.strictEqual(resP2.acao, 'fila_urgente_humana')
  })

  it('Regra 2: deve encaminhar para fila_validacao_humana quando necessita_validacao_humana = true e prioridade = P3/P4/P5', () => {
    const resP3 = decidirDespacho({
      prioridade: 'P3',
      necessita_validacao_humana: true,
      confidence: 0.4, // Baixa confiança
    })

    assert.strictEqual(resP3.acao, 'fila_validacao_humana')
    assert.match(resP3.motivo, /Validação humana requerida/)
  })

  it('Regra 3: deve encaminhar para fila_automatica quando prioridade = P4 ou P5, confidence >= 0.85 e reportes < 5', () => {
    const resP4 = decidirDespacho({
      prioridade: 'P4',
      necessita_validacao_humana: false,
      confidence: 0.9,
      quantidade_reportes: 2,
    })

    assert.strictEqual(resP4.acao, 'fila_automatica')
    assert.match(resP4.motivo, /baixo risco/)

    const resP5 = decidirDespacho({
      prioridade: 'P5',
      necessita_validacao_humana: false,
      confidence: 0.88,
      quantidade_reportes: 1,
    })

    assert.strictEqual(resP5.acao, 'fila_automatica')
  })

  it('Regra 4: deve cair no fallback seguro fila_validacao_humana para outros casos (ex: P3 sem validacao obrigatoria)', () => {
    const resFallback = decidirDespacho({
      prioridade: 'P3',
      necessita_validacao_humana: false,
      confidence: 0.88,
      quantidade_reportes: 1,
    })

    assert.strictEqual(resFallback.acao, 'fila_validacao_humana')
    assert.match(resFallback.motivo, /fila de validação humana padrão/)
  })
})
