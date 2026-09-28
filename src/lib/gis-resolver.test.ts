import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  resolverContextoRede,
  montarPriorityInputComPrecedencia,
  RAIO_BUSCA_GIS_METROS,
} from './gis-resolver'
import { ContextoRede, ClassificacaoGemini } from '@/types/ocorrencia'

describe('GIS Resolver & Precedence Rule Tests', () => {
  const mockAtivos: ContextoRede[] = [
    {
      id: 'ativo-1',
      nome_ativo: 'Conduta Adutora Baixa de Maputo',
      tipo_infraestrutura: 'principal',
      diametro_mm: 300,
      latitude: 38.7138,
      longitude: -9.1394,
      clientes_estimados: 5000,
      pressao_estimada_bar: 4.5,
      distancia_metros: 0,
    },
    {
      id: 'ativo-2',
      nome_ativo: 'Ramal Secundário Av. 25 de Setembro',
      tipo_infraestrutura: 'secundaria',
      diametro_mm: 80,
      latitude: 38.7140, // Muito perto de 38.7139
      longitude: -9.1394,
      clientes_estimados: 120,
      pressao_estimada_bar: 3.0,
      distancia_metros: 0,
    },
  ]

  it('deve encontrar o ativo de rede mais próximo dentro do raio configurado', async () => {
    // Coordenada a ~11 metros do ativo-1 e a ~22 metros do ativo-2
    const latOcorrencia = 38.7137
    const lonOcorrencia = -9.1394

    const resultado = await resolverContextoRede(latOcorrencia, lonOcorrencia, mockAtivos)

    assert.notStrictEqual(resultado, null)
    assert.strictEqual(resultado?.id, 'ativo-1')
    assert.ok(resultado!.distancia_metros <= RAIO_BUSCA_GIS_METROS)
  })

  it('deve retornar null se nenhum ativo estiver dentro do raio de 30 metros', async () => {
    // Coordenada distante (~1km de distância)
    const latOcorrencia = 38.7250
    const lonOcorrencia = -9.1500

    const resultado = await resolverContextoRede(latOcorrencia, lonOcorrencia, mockAtivos)

    assert.strictEqual(resultado, null)
  })

  it('deve aplicar a regra de precedência GIS > Gemini para diâmetro e infraestrutura', () => {
    const mockClassificacaoGemini: ClassificacaoGemini = {
      is_leak: true,
      confidence: 0.8,
      leak_type: 'ruptura',
      estimated_pipe_diameter_mm: 20, // Gemini estimou 20mm (pequeno)
      water_flow: 'grande_fluxo',
      affected_area: 'rua',
      infrastructure_type: 'residencia', // Gemini estimou residencia
      visible_damage: true,
      risk_to_people: 'baixo',
      risk_to_property: 'medio',
      reason: 'Gotas e fluxo visivel',
    }

    const gisAtivo: ContextoRede = {
      id: 'ativo-1',
      nome_ativo: 'Conduta Principal',
      tipo_infraestrutura: 'principal', // GIS diz que é conduta principal (5)
      diametro_mm: 250, // GIS diz que é 250mm (>200mm -> 5)
      latitude: 38.7138,
      longitude: -9.1394,
      clientes_estimados: 5000,
      pressao_estimada_bar: 4.5,
      distancia_metros: 5,
    }

    const { priorityInput, fontesDados } = montarPriorityInputComPrecedencia(
      mockClassificacaoGemini,
      {},
      gisAtivo
    )

    // GIS prevalece: infraestrutura=5 (principal) e diametro=5 (>200mm)
    assert.strictEqual(priorityInput.infraestrutura, 5)
    assert.strictEqual(priorityInput.diametro, 5)
    assert.strictEqual(fontesDados.infraestrutura, 'gis')
    assert.strictEqual(fontesDados.diametro, 'gis')
    assert.strictEqual(fontesDados.risco, 'gemini')
  })

  it('deve usar o Gemini como fallback se o contexto GIS for null', () => {
    const mockClassificacaoGemini: ClassificacaoGemini = {
      is_leak: true,
      confidence: 0.8,
      leak_type: 'ruptura',
      estimated_pipe_diameter_mm: 20,
      water_flow: 'gotas',
      affected_area: 'jardim',
      infrastructure_type: 'residencia',
      visible_damage: false,
      risk_to_people: 'nenhum',
      risk_to_property: 'nenhum',
      reason: 'Observacao visual',
    }

    const { priorityInput, fontesDados } = montarPriorityInputComPrecedencia(
      mockClassificacaoGemini,
      {},
      null
    )

    assert.strictEqual(fontesDados.infraestrutura, 'gemini')
    assert.strictEqual(fontesDados.diametro, 'gemini')
    assert.strictEqual(priorityInput.infraestrutura, 1)
    assert.strictEqual(priorityInput.diametro, 1)
  })
})
