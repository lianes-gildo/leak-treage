import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarAssinaturaHmac,
  verificarAssinaturaHmac,
  verificarApiKeyIntegracao,
  formatarOcorrenciasParaGeoJSON,
  despacharWebhookMapa,
  DEFAULT_INTEGRATION_API_KEY,
} from './integracao-externa'
import { Ocorrencia } from '@/types/ocorrencia'

describe('Motor de Integração Externa & Segurança Criptográfica (Mapa de Distribuição)', () => {
  it('deve gerar e verificar assinatura HMAC-SHA256 válida para o payload', () => {
    const payload = JSON.stringify({ evento: 'ocorrencia.validada', id: 'oc-123', prioridade: 'P1' })
    const secret = 'chave_secreta_teste_123'

    const assinatura = gerarAssinaturaHmac(payload, secret)
    assert.ok(assinatura.length === 64, 'Assinatura HMAC-SHA256 deve ter 64 caracteres hexadecimais')

    const valido = verificarAssinaturaHmac(payload, assinatura, secret)
    assert.strictEqual(valido, true, 'Assinatura correta deve ser validada com sucesso')

    // Deve suportar prefixo 'sha256='
    const validoComPrefixo = verificarAssinaturaHmac(payload, `sha256=${assinatura}`, secret)
    assert.strictEqual(validoComPrefixo, true, 'Deve validar mesmo com prefixo sha256=')
  })

  it('deve rejeitar payload adulterado ou com assinatura incorreta (Integridade e Anti-Adulteração)', () => {
    const payloadOriginal = JSON.stringify({ evento: 'ocorrencia.validada', prioridade: 'P1' })
    const payloadAdulterado = JSON.stringify({ evento: 'ocorrencia.validada', prioridade: 'P5' })
    const secret = 'chave_secreta_teste_123'

    const assinatura = gerarAssinaturaHmac(payloadOriginal, secret)

    const valido = verificarAssinaturaHmac(payloadAdulterado, assinatura, secret)
    assert.strictEqual(valido, false, 'Payload adulterado deve falhar na validação HMAC')

    const validoSecretErrado = verificarAssinaturaHmac(payloadOriginal, assinatura, 'outro_secret')
    assert.strictEqual(validoSecretErrado, false, 'Segredo incorreto deve falhar na validação')
  })

  it('deve autenticar requisições via X-API-Key, Authorization Bearer e Query Param em tempo constante', () => {
    // 1. Chave correta via X-API-Key
    assert.strictEqual(
      verificarApiKeyIntegracao(null, DEFAULT_INTEGRATION_API_KEY),
      true,
      'Deve autenticar chave válida via X-API-Key'
    )

    // 2. Chave correta via Bearer Token
    assert.strictEqual(
      verificarApiKeyIntegracao(`Bearer ${DEFAULT_INTEGRATION_API_KEY}`, null),
      true,
      'Deve autenticar chave válida via Bearer Token'
    )

    // 3. Chave correta via Query Param (?api_key=...)
    assert.strictEqual(
      verificarApiKeyIntegracao(null, null, DEFAULT_INTEGRATION_API_KEY),
      true,
      'Deve autenticar chave válida via Query Param'
    )

    // 4. Sessão de operador autenticado no dashboard
    assert.strictEqual(
      verificarApiKeyIntegracao(null, null, null, true),
      true,
      'Deve autenticar se o operador tiver sessão ativa no dashboard'
    )

    // 5. Chave incorreta via Query Param
    assert.strictEqual(
      verificarApiKeyIntegracao(null, null, 'chave_invalida_hack'),
      false,
      'Deve rejeitar chave inválida via query param'
    )

    // 6. Sem chave
    assert.strictEqual(
      verificarApiKeyIntegracao(null, null, null, false),
      false,
      'Deve rejeitar requisição sem credenciais'
    )
  })

  it('deve formatar GeoJSON FeatureCollection omitindo rigorosamente ocorrências descartadas pelo operador', () => {
    const ocorrenciasTeste: Ocorrencia[] = [
      {
        id: 'oc-aprovada-1',
        cliente_id: null,
        foto_url: 'https://exemplo.com/foto1.jpg',
        latitude: -25.9692,
        longitude: 32.5732,
        local_fuga: 'estrada',
        agua_saindo_agora: true,
        intensidade_reportada: 'jacto',
        afeta_outros: 'rua_zona',
        classificacao_gemini: {
          is_leak: true,
          confidence: 0.95,
          leak_type: 'rotura_via',
          estimated_pipe_diameter_mm: 200,
          water_flow: 'grande_fluxo',
          affected_area: 'asfalto',
          infrastructure_type: 'principal',
          visible_damage: true,
          risk_to_people: 'medio',
          risk_to_property: 'alto',
          reason: 'Fuga com grande volume',
        },
        prioridade: 'P1',
        priority_score: 90,
        confidence: 0.95,
        status: 'validado', // Aprovada pelo operador para envio ao mapa
        validado_por: 'Operador Carlos',
        criado_em: '2026-09-27T10:00:00Z',
        atualizado_em: '2026-09-27T10:05:00Z',
      },
      {
        id: 'oc-descartada-2',
        cliente_id: null,
        foto_url: 'https://exemplo.com/foto2.jpg',
        latitude: -25.9700,
        longitude: 32.5750,
        local_fuga: 'dentro_residencia',
        agua_saindo_agora: true,
        intensidade_reportada: 'gotas',
        afeta_outros: 'nao',
        classificacao_gemini: null,
        prioridade: 'P5',
        priority_score: 10,
        confidence: 0.8,
        status: 'rejeitado', // DESCARTADA pelo operador (fora de âmbito)
        motivo_rejeicao: 'Rede predial interna privada (responsabilidade do utente)',
        validado_por: 'Operador Carlos',
        criado_em: '2026-09-27T10:10:00Z',
        atualizado_em: '2026-09-27T10:15:00Z',
      },
      {
        id: 'oc-sem-coordenadas-3',
        cliente_id: null,
        foto_url: 'https://exemplo.com/foto3.jpg',
        latitude: null,
        longitude: null,
        local_fuga: 'outro',
        agua_saindo_agora: false,
        intensidade_reportada: null,
        afeta_outros: null,
        classificacao_gemini: null,
        prioridade: 'P3',
        priority_score: 50,
        confidence: 0.7,
        status: 'validado',
        validado_por: 'Operador Carlos',
        criado_em: '2026-09-27T10:20:00Z',
        atualizado_em: '2026-09-27T10:25:00Z',
      },
    ]

    const geojson = formatarOcorrenciasParaGeoJSON(ocorrenciasTeste)

    assert.strictEqual(geojson.type, 'FeatureCollection')
    assert.strictEqual(
      geojson.features.length,
      1,
      'Apenas a ocorrência validada com coordenadas deve constar no GeoJSON do mapa'
    )

    const feature = geojson.features[0]
    assert.strictEqual(feature.type, 'Feature')
    assert.strictEqual(feature.geometry.type, 'Point')
    // Coordenadas GeoJSON [longitude, latitude]
    assert.strictEqual(feature.geometry.coordinates[0], 32.5732)
    assert.strictEqual(feature.geometry.coordinates[1], -25.9692)
    assert.strictEqual(feature.properties.id, 'oc-aprovada-1')
    assert.strictEqual(feature.properties.prioridade, 'P1')
    assert.strictEqual(feature.properties.status, 'validado')
  })

  it('despacharWebhookMapa deve retornar sucesso resiliente mesmo quando webhook externo não estiver configurado', async () => {
    const ocTeste: Ocorrencia = {
      id: 'oc-teste-disp',
      cliente_id: null,
      foto_url: 'https://exemplo.com/teste.jpg',
      latitude: -25.965,
      longitude: 32.58,
      local_fuga: 'passeio',
      agua_saindo_agora: true,
      intensidade_reportada: 'pequeno_fluxo',
      afeta_outros: 'uma_residencia',
      classificacao_gemini: null,
      prioridade: 'P2',
      priority_score: 65,
      confidence: 0.9,
      status: 'validado',
      validado_por: 'Operador Maria',
      criado_em: '2026-09-27T12:00:00Z',
      atualizado_em: '2026-09-27T12:05:00Z',
    }

    const resultado = await despacharWebhookMapa(ocTeste)
    assert.strictEqual(resultado.sucesso, true)
    assert.ok(resultado.idempotencyKey.includes('oc-teste-disp'))
    assert.ok(resultado.timestamp.length > 0)
  })
})
