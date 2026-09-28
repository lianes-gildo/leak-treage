import { describe, it } from 'node:test'
import assert from 'node:assert'
import { sugerirEquipa } from './atribuicao'
import { Equipa } from '@/types/ocorrencia'

describe('Team Assignment Suggestion Tests', () => {
  const mockEquipas: Equipa[] = [
    {
      id: 'eq-1',
      nome: 'Equipa Alpha - Redes Secundárias',
      tipos_infraestrutura: ['residencial', 'secundaria'],
      ativa: true,
      criado_em: new Date().toISOString(),
    },
    {
      id: 'eq-2',
      nome: 'Equipa Beta - Condutas Principais',
      tipos_infraestrutura: ['principal', 'reservatorio'],
      ativa: true,
      criado_em: new Date().toISOString(),
    },
  ]

  it('deve sugerir a equipa correta quando houver correspondência com a infraestrutura', () => {
    const equipaPrincipal = sugerirEquipa('principal', mockEquipas)
    assert.strictEqual(equipaPrincipal, 'Equipa Beta - Condutas Principais')

    const equipaResidencial = sugerirEquipa('residencial', mockEquipas)
    assert.strictEqual(equipaResidencial, 'Equipa Alpha - Redes Secundárias')
  })

  it('deve retornar null se nenhuma equipa for compatível', () => {
    const resSemMatch = sugerirEquipa('subestacao_eletrica_desconhecida', mockEquipas)
    assert.strictEqual(resSemMatch, null)
  })
})
