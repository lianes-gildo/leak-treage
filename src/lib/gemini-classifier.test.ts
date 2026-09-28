import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mapearParaPriorityInput } from './gemini-classifier'
import { ClassificacaoGemini } from '@/types/ocorrencia'

describe('Gemini Mapper (mapearParaPriorityInput)', () => {
  it('deve mapear corretamente risco critico e conduta principal para escala 5', () => {
    const mockClassificacao: ClassificacaoGemini = {
      is_leak: true,
      confidence: 0.95,
      leak_type: 'ruptura_tubo',
      estimated_pipe_diameter_mm: 250,
      water_flow: 'jacto',
      affected_area: 'rua_principal',
      infrastructure_type: 'conduta_principal',
      visible_damage: true,
      risk_to_people: 'critico',
      risk_to_property: 'critico',
      reason: 'Fuga massiva em conduta com risco extremo.',
    }

    const input = mapearParaPriorityInput(mockClassificacao, {
      local_fuga: 'conduta',
      intensidade_reportada: 'jacto',
      afeta_outros: 'rua_zona',
    })

    assert.strictEqual(input.risco, 5)
    assert.strictEqual(input.impacto, 5)
    assert.strictEqual(input.caudal, 5)
    assert.strictEqual(input.infraestrutura, 5)
    assert.strictEqual(input.diametro, 5)
    assert.strictEqual(input.confidence, 0.95)
  })

  it('deve mapear fuga residencial pequena para escala 1', () => {
    const mockClassificacao: ClassificacaoGemini = {
      is_leak: true,
      confidence: 0.88,
      leak_type: 'gotas_torneira',
      estimated_pipe_diameter_mm: 15,
      water_flow: 'gotas',
      affected_area: 'jardim',
      infrastructure_type: 'residencia',
      visible_damage: false,
      risk_to_people: 'nenhum',
      risk_to_property: 'nenhum',
      reason: 'Gotas de torneira no jardim.',
    }

    const input = mapearParaPriorityInput(mockClassificacao, {
      local_fuga: 'dentro_residencia',
      intensidade_reportada: 'gotas',
      afeta_outros: 'nao',
    })

    assert.strictEqual(input.risco, 1)
    assert.strictEqual(input.impacto, 1)
    assert.strictEqual(input.caudal, 1)
    assert.strictEqual(input.infraestrutura, 1)
    assert.strictEqual(input.diametro, 1)
    assert.strictEqual(input.confidence, 0.88)
  })

  it('deve mapear imagem sem fuga (is_leak = false, water_flow = nenhum) para nivel 1 em tudo', () => {
    const mockClassificacao: ClassificacaoGemini = {
      is_leak: false,
      confidence: 0.99,
      leak_type: 'nenhum',
      estimated_pipe_diameter_mm: null,
      water_flow: 'nenhum',
      affected_area: 'nenhuma',
      infrastructure_type: 'outro',
      visible_damage: false,
      risk_to_people: 'nenhum',
      risk_to_property: 'nenhum',
      reason: 'A imagem retrata um quarto seco sem qualquer indício de água ou dano hidráulico.',
    }

    const input = mapearParaPriorityInput(mockClassificacao, {
      local_fuga: 'dentro_residencia',
      intensidade_reportada: 'gotas',
      afeta_outros: 'nao',
    })

    assert.strictEqual(input.caudal, 1)
    assert.strictEqual(input.risco, 1)
    assert.strictEqual(input.impacto, 1)
    assert.strictEqual(input.infraestrutura, 1)
    assert.strictEqual(input.diametro, 1)
    assert.strictEqual(input.confidence, 0.99)
  })
})

