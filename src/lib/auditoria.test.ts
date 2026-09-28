import { describe, it } from 'node:test'
import assert from 'node:assert'
import { registrarEvento } from './auditoria'
import { AuditoriaOcorrencia } from '@/types/ocorrencia'

describe('Audit Trail Tests', () => {
  it('deve registrar eventos de auditoria com valor anterior, valor novo e autor', async () => {
    const mockAuditStore: AuditoriaOcorrencia[] = []

    const ok = await registrarEvento(
      {
        ocorrencia_id: 'oc-100',
        tipo_evento: 'correcao_manual',
        valor_anterior: { prioridade: 'P3' },
        valor_novo: { prioridade: 'P1' },
        motivo: 'Operador identificou risco próximo de escola',
        autor: 'op_joao',
      },
      mockAuditStore
    )

    assert.strictEqual(ok, true)
    assert.strictEqual(mockAuditStore.length, 1)
    assert.strictEqual(mockAuditStore[0].ocorrencia_id, 'oc-100')
    assert.strictEqual(mockAuditStore[0].tipo_evento, 'correcao_manual')
    assert.strictEqual(mockAuditStore[0].autor, 'op_joao')
  })
})
