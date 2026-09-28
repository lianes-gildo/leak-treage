import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  calcularSLALimite,
  escalonarOcorrenciasVencidas,
} from './escalonamento'
import { Ocorrencia } from '@/types/ocorrencia'

describe('SLA & Escalation Engine Tests', () => {
  it('deve calcular corretamente os prazos de SLA por prioridade', () => {
    const inicio = new Date('2026-08-31T10:00:00Z')

    const slaP1 = calcularSLALimite('P1', inicio)
    assert.strictEqual(slaP1.toISOString(), '2026-08-31T10:00:00.000Z')

    const slaP2 = calcularSLALimite('P2', inicio)
    assert.strictEqual(slaP2.toISOString(), '2026-08-31T12:00:00.000Z') // +2h

    const slaP3 = calcularSLALimite('P3', inicio)
    assert.strictEqual(slaP3.toISOString(), '2026-08-31T18:00:00.000Z') // +8h

    const slaP4 = calcularSLALimite('P4', inicio)
    assert.strictEqual(slaP4.toISOString(), '2026-09-01T10:00:00.000Z') // +24h

    const slaP5 = calcularSLALimite('P5', inicio)
    assert.strictEqual(slaP5.toISOString(), '2026-09-02T10:00:00.000Z') // +48h
  })

  it('ocorrência dentro do SLA não deve ser escalonada', async () => {
    const futuro = new Date(Date.now() + 5 * 60 * 60 * 1000) // Vence daqui a 5h

    const mockOcorrencia: Partial<Ocorrencia> = {
      id: 'oc-futura',
      prioridade: 'P3',
      status: 'pendente',
      escalonada: false,
      sla_limite: futuro.toISOString(),
    }

    const res = await escalonarOcorrenciasVencidas([mockOcorrencia as Ocorrencia])

    assert.strictEqual(res.escalonadas, 0)
    assert.strictEqual(mockOcorrencia.escalonada, false)
    assert.strictEqual(mockOcorrencia.prioridade, 'P3')
  })

  it('ocorrência com SLA vencido deve subir um nível de prioridade (P3 -> P2)', async () => {
    const passado = new Date(Date.now() - 1 * 60 * 60 * 1000) // Venceu há 1h

    const mockOcorrencia: Partial<Ocorrencia> = {
      id: 'oc-vencida-p3',
      prioridade: 'P3',
      status: 'pendente',
      escalonada: false,
      sla_limite: passado.toISOString(),
    }

    const res = await escalonarOcorrenciasVencidas([mockOcorrencia as Ocorrencia])

    assert.strictEqual(res.escalonadas, 1)
    assert.strictEqual(mockOcorrencia.escalonada, true)
    assert.strictEqual(mockOcorrencia.prioridade_original, 'P3')
    assert.strictEqual(mockOcorrencia.prioridade, 'P2')
  })

  it('ocorrência P1 com SLA vencido não escalona além de P1, mas regista mensagem no log', async () => {
    const passado = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const mockOcorrencia: Partial<Ocorrencia> = {
      id: 'oc-vencida-p1',
      prioridade: 'P1',
      status: 'em_validacao',
      escalonada: false,
      sla_limite: passado.toISOString(),
    }

    const res = await escalonarOcorrenciasVencidas([mockOcorrencia as Ocorrencia])

    assert.strictEqual(res.escalonadas, 0)
    assert.strictEqual(mockOcorrencia.prioridade, 'P1')
    assert.strictEqual(res.logs.length, 1)
    assert.match(res.logs[0], /já se encontra no topo da prioridade/)
  })
})
