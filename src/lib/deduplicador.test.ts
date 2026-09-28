import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  encontrarOuCriarGrupo,
  aplicarAmplificacaoPorVolume,
} from './deduplicador'
import { Ocorrencia, GrupoOcorrencia } from '@/types/ocorrencia'

describe('Deduplication & Volume Amplification Tests', () => {
  it('primeira ocorrência isolada deve criar um novo grupo com quantidade = 1', async () => {
    const mockStore = {
      ocorrenciasExistentes: [],
      gruposExistentes: [],
    }

    const ocorrencia: Partial<Ocorrencia> = {
      id: 'oc-1',
      latitude: 38.7138,
      longitude: -9.1394,
      criado_em: new Date().toISOString(),
      prioridade: 'P3',
      status: 'pendente',
    }

    const res = await encontrarOuCriarGrupo(ocorrencia as Ocorrencia, mockStore)

    assert.strictEqual(res.quantidade_reportes, 1)
    assert.strictEqual(mockStore.gruposExistentes.length, 1)
  })

  it('segunda ocorrência próxima (<50m e <6h) deve ser associada ao grupo existente e incrementar para quantidade = 2', async () => {
    const agora = new Date()
    const grupoInicial: GrupoOcorrencia = {
      id: 'grupo-100',
      prioridade_consolidada: 'P3',
      quantidade_reportes: 1,
      raio_metros: 50,
      criado_em: agora.toISOString(),
      atualizado_em: agora.toISOString(),
    }

    const ocorrenciaAnterior: Partial<Ocorrencia> = {
      id: 'oc-antiga',
      latitude: 38.7138,
      longitude: -9.1394,
      grupo_id: 'grupo-100',
      criado_em: agora.toISOString(),
      status: 'em_validacao',
    }

    const mockStore = {
      ocorrenciasExistentes: [ocorrenciaAnterior as Ocorrencia],
      gruposExistentes: [grupoInicial],
    }

    // Ocorrência enviada a ~10 metros da anterior
    const novaOcorrencia: Partial<Ocorrencia> = {
      id: 'oc-nova',
      latitude: 38.7139,
      longitude: -9.1394,
      criado_em: agora.toISOString(),
      prioridade: 'P3',
      status: 'pendente',
    }

    const res = await encontrarOuCriarGrupo(novaOcorrencia as Ocorrencia, mockStore)

    assert.strictEqual(res.grupo_id, 'grupo-100')
    assert.strictEqual(res.quantidade_reportes, 2)
  })

  it('ocorrência fora do raio (>50m) ou fora da janela de tempo (>6h) deve criar um novo grupo', async () => {
    const agora = new Date()
    // Ocorrência criada há 8 horas atrás (>6h)
    const dataAntiga = new Date(agora.getTime() - 8 * 60 * 60 * 1000)

    const ocorrenciaAntiga: Partial<Ocorrencia> = {
      id: 'oc-antiga',
      latitude: 38.7138,
      longitude: -9.1394,
      grupo_id: 'grupo-antigo',
      criado_em: dataAntiga.toISOString(),
      status: 'em_validacao',
    }

    const mockStore = {
      ocorrenciasExistentes: [ocorrenciaAntiga as Ocorrencia],
      gruposExistentes: [],
    }

    const novaOcorrencia: Partial<Ocorrencia> = {
      id: 'oc-nova',
      latitude: 38.7138,
      longitude: -9.1394,
      criado_em: agora.toISOString(),
      prioridade: 'P4',
      status: 'pendente',
    }

    const res = await encontrarOuCriarGrupo(novaOcorrencia as Ocorrencia, mockStore)

    assert.notStrictEqual(res.grupo_id, 'grupo-antigo')
    assert.strictEqual(res.quantidade_reportes, 1)
  })

  it('deve aplicar a regra de amplificação por volume de reportes no grupo', () => {
    // 1. Grupo com 4 reportes: não força piso, mantém prioridade calculada P3
    const p3Com4 = aplicarAmplificacaoPorVolume('P3', 4)
    assert.strictEqual(p3Com4, 'P3')

    // 2. Grupo com 5 reportes: força piso P2 (P4 sobe para P2)
    const p4Com5 = aplicarAmplificacaoPorVolume('P4', 5)
    assert.strictEqual(p4Com5, 'P2')

    // P1 com 5 reportes continua P1
    const p1Com5 = aplicarAmplificacaoPorVolume('P1', 5)
    assert.strictEqual(p1Com5, 'P1')

    // 3. Grupo com 10 reportes: força piso P1 (P3 sobe para P1)
    const p3Com10 = aplicarAmplificacaoPorVolume('P3', 10)
    assert.strictEqual(p3Com10, 'P1')
  })
})
