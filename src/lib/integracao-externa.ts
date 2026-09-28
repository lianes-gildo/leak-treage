import crypto from 'crypto'
import {
  Ocorrencia,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONFeatureProperties,
  EventoIntegracaoMapa,
} from '@/types/ocorrencia'

/**
 * Chave de API padrão para ambiente de desenvolvimento / teste.
 * Em produção, deve ser definida a variável MAPA_INTEGRACAO_API_KEY.
 */
export const DEFAULT_INTEGRATION_API_KEY = 'saas_sec_mapa_dev_key_2026'

/**
 * Segredo HMAC padrão para assinatura de webhooks de saída.
 * Em produção, deve ser definida a variável MAPA_WEBHOOK_SECRET.
 */
export const DEFAULT_WEBHOOK_SECRET = 'saas_webhook_hmac_secret_2026_prod'

/**
 * Gera a assinatura HMAC-SHA256 de um payload de integração para garantia de
 * autenticidade, integridade e não-repúdio.
 */
export function gerarAssinaturaHmac(payload: string, secret: string = getWebhookSecret()): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Validação criptograficamente segura de assinatura HMAC utilizando tempo constante
 * (timing-safe) para mitigar ataques de temporização (timing attacks).
 */
export function verificarAssinaturaHmac(
  payload: string,
  assinaturaHex: string,
  secret: string = getWebhookSecret()
): boolean {
  if (!payload || !assinaturaHex) return false

  const cleanAssinatura = assinaturaHex.replace(/^sha256=/i, '').trim().toLowerCase()
  const assinaturaEsperada = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  const bufEsperado = Buffer.from(assinaturaEsperada, 'hex')
  const bufRecebido = Buffer.from(cleanAssinatura, 'hex')

  if (bufEsperado.length !== bufRecebido.length) {
    return false
  }

  return crypto.timingSafeEqual(bufEsperado, bufRecebido)
}

/**
 * Obtém a chave de API de integração configurada.
 */
export function getIntegrationApiKey(): string {
  return process.env.MAPA_INTEGRACAO_API_KEY || DEFAULT_INTEGRATION_API_KEY
}

/**
 * Obtém o segredo do Webhook.
 */
export function getWebhookSecret(): string {
  return process.env.MAPA_WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET
}

/**
 * Validação de chave de API em tempo constante (timing-safe).
 * Aceita autenticação via:
 * 1. Cabeçalho 'X-API-Key'
 * 2. Cabeçalho 'Authorization: Bearer <token>'
 * 3. Parâmetro de consulta URL '?api_key=<token>' ou '?token=<token>'
 * 4. Sessão autenticada do operador no dashboard (isSessionAuth)
 */
export function verificarApiKeyIntegracao(
  authHeader: string | null,
  apiKeyHeader: string | null,
  queryApiKey?: string | null,
  isSessionAuth?: boolean
): boolean {
  if (isSessionAuth) {
    return true
  }

  const chaveConfigurada = getIntegrationApiKey()

  let chaveFornecida = ''
  if (apiKeyHeader) {
    chaveFornecida = apiKeyHeader.trim()
  } else if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    chaveFornecida = authHeader.substring(7).trim()
  } else if (queryApiKey) {
    chaveFornecida = queryApiKey.trim()
  }

  if (!chaveFornecida) {
    return false
  }

  const bufConfigurada = Buffer.from(chaveConfigurada)
  const bufFornecida = Buffer.from(chaveFornecida)

  if (bufConfigurada.length !== bufFornecida.length) {
    return false
  }

  return crypto.timingSafeEqual(bufConfigurada, bufFornecida)
}

/**
 * Mapeia os atributos operacionais de uma ocorrência para as propriedades seguras de GeoJSON.
 */
export function converterOcorrenciaParaProperties(oc: Ocorrencia): GeoJSONFeatureProperties {
  const protocolo = `PROT-${oc.id.substring(0, 8).toUpperCase()}`
  return {
    id: oc.id,
    protocolo,
    prioridade: oc.prioridade,
    priority_score: oc.priority_score,
    confidence: oc.confidence,
    status: oc.status,
    local_fuga: oc.local_fuga,
    agua_saindo_agora: oc.agua_saindo_agora,
    intensidade_reportada: oc.intensidade_reportada,
    afeta_outros: oc.afeta_outros,
    tipo_infraestrutura: oc.classificacao_gemini?.infrastructure_type || null,
    diametro_mm: oc.classificacao_gemini?.estimated_pipe_diameter_mm || null,
    caudal: oc.classificacao_gemini?.water_flow || null,
    foto_url: oc.foto_url,
    validado_por: oc.validado_por,
    criado_em: oc.criado_em,
    validado_em: oc.atualizado_em || oc.criado_em,
  }
}

/**
 * Converte uma lista de ocorrências validadas numa FeatureCollection GeoJSON estrita (RFC 7946).
 * Ocorrências rejeitadas/descartadas ou sem coordenadas válidas são estritamente omitidas.
 */
export function formatarOcorrenciasParaGeoJSON(
  ocorrencias: Ocorrencia[]
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []

  for (const oc of ocorrencias) {
    // REGRA DE ISOLAMENTO: Apenas ocorrências aprovadas e com coordenadas válidas são expostas ao mapa
    if (oc.status !== 'validado') {
      continue
    }

    if (
      typeof oc.latitude !== 'number' ||
      typeof oc.longitude !== 'number' ||
      isNaN(oc.latitude) ||
      isNaN(oc.longitude)
    ) {
      continue
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        // Padrão GeoJSON RFC 7946: [longitude, latitude]
        coordinates: [oc.longitude, oc.latitude],
      },
      properties: converterOcorrenciaParaProperties(oc),
    })
  }

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      total: features.length,
      gerado_em: new Date().toISOString(),
      origem: 'SAAS Maputo — Triagem Operacional de Fugas',
    },
  }
}

/**
 * Cria o payload do evento de integração assinado para envio via Webhook ao sistema externo.
 */
export function criarEventoIntegracao(
  oc: Ocorrencia,
  tipoEvento: EventoIntegracaoMapa['event_type'] = 'ocorrencia.validada'
): EventoIntegracaoMapa {
  return {
    event_id: `evt_${crypto.randomUUID()}`,
    event_type: tipoEvento,
    timestamp: new Date().toISOString(),
    ocorrencia: {
      ...converterOcorrenciaParaProperties(oc),
      coordenadas: {
        latitude: oc.latitude,
        longitude: oc.longitude,
      },
    },
  }
}

/**
 * Despacha em tempo real o evento da ocorrência validada para o sistema externo (ex: Mapa de Distribuição).
 * Utiliza HMAC-SHA256, chave de idempotência e tolerância a falhas.
 */
export async function despacharWebhookMapa(
  ocorrencia: Ocorrencia
): Promise<{
  sucesso: boolean
  mensagem: string
  statusCode?: number
  idempotencyKey: string
  timestamp: string
}> {
  const webhookUrl = process.env.MAPA_WEBHOOK_URL
  const idempotencyKey = `oc_${ocorrencia.id}_${ocorrencia.atualizado_em || Date.now()}`
  const timestamp = new Date().toISOString()

  // Se não houver URL de webhook configurada, considera despachado localmente para o feed de consumo
  if (!webhookUrl) {
    return {
      sucesso: true,
      mensagem:
        'Ocorrência aprovada e disponibilizada para consumo no endpoint seguro da API (/api/v1/integracao/mapa). (Webhook externo não configurado).',
      idempotencyKey,
      timestamp,
    }
  }

  const evento = criarEventoIntegracao(ocorrencia, 'ocorrencia.validada')
  const payloadString = JSON.stringify(evento)
  const assinatura = gerarAssinaturaHmac(payloadString)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-SHA256': `sha256=${assinatura}`,
        'X-Timestamp': timestamp,
        'X-Idempotency-Key': idempotencyKey,
        'X-Event-Type': 'ocorrencia.validada',
        'User-Agent': 'SAAS-Maputo-Triage-Gateway/1.0',
      },
      body: payloadString,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const latencia = Date.now() - new Date(timestamp).getTime()

    if (!response.ok) {
      atualizarStatusConexao({
        conectado: false,
        latenciaMs: Math.max(latencia, 1),
        mensagem: `Sistema externo respondeu com HTTP ${response.status}`,
        modo: 'desconectado',
      })

      return {
        sucesso: false,
        statusCode: response.status,
        mensagem: `Sistema externo respondeu com HTTP ${response.status}`,
        idempotencyKey,
        timestamp,
      }
    }

    atualizarStatusConexao({
      conectado: true,
      latenciaMs: Math.max(latencia, 1),
      mensagem: 'Ocorrência transmitida com sucesso para o Mapa de Distribuição.',
      modo: 'webhook_ativo',
    })

    return {
      sucesso: true,
      statusCode: response.status,
      mensagem: 'Ocorrência transmitida com sucesso para o sistema do Mapa de Distribuição.',
      idempotencyKey,
      timestamp,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    atualizarStatusConexao({
      conectado: false,
      mensagem: `Falha de rede ao contactar sistema externo: ${msg}`,
      modo: 'desconectado',
    })

    return {
      sucesso: false,
      mensagem: `Falha de rede ao contactar sistema externo: ${msg}`,
      idempotencyKey,
      timestamp,
    }
  }
}

// --- MONITORIZAÇÃO DE ESTADO DE COMUNICAÇÃO (GREEN/RED HEALTH CHECK) ---

export interface StatusConexaoExterna {
  conectado: boolean
  latenciaMs: number
  mensagem: string
  verificadoEm: string
  urlDestino: string | null
  modo: 'webhook_ativo' | 'api_polling' | 'desconectado'
  ultimoConsumoEm?: string | null
  totalConsumos?: number
}

let ultimoStatusConexao: StatusConexaoExterna = {
  conectado: true,
  latenciaMs: 1,
  mensagem: 'Canal de integração pronto para consumo via API GeoJSON autenticada.',
  verificadoEm: new Date().toISOString(),
  urlDestino: process.env.MAPA_WEBHOOK_URL || null,
  modo: process.env.MAPA_WEBHOOK_URL ? 'webhook_ativo' : 'api_polling',
  ultimoConsumoEm: null,
  totalConsumos: 0,
}

/**
 * Regista evento de atividade ou consumo por parte do sistema externo (Pull ou Handshake Ping).
 */
export function registrarAtividadeIntegracao(
  tipo: 'api_pull' | 'ping' | 'webhook',
  detalhes?: string
): void {
  const agoraIso = new Date().toISOString()
  ultimoStatusConexao = {
    ...ultimoStatusConexao,
    conectado: true,
    latenciaMs: ultimoStatusConexao.latenciaMs || 1,
    mensagem:
      detalhes ||
      (tipo === 'api_pull'
        ? 'Dados GeoJSON consumidos com sucesso pelo sistema externo.'
        : 'Handshake ativo confirmado com o sistema externo.'),
    verificadoEm: agoraIso,
    ultimoConsumoEm: agoraIso,
    totalConsumos: (ultimoStatusConexao.totalConsumos || 0) + 1,
    modo: process.env.MAPA_WEBHOOK_URL ? 'webhook_ativo' : 'api_polling',
  }
}

export function obterStatusConexao(): StatusConexaoExterna {
  const webhookUrl = process.env.MAPA_WEBHOOK_URL
  const isLocalhostWebhook =
    webhookUrl && (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1'))

  // Alerta arquitetural: Webhook para localhost configurado no Render cloud
  if (isLocalhostWebhook && process.env.NODE_ENV === 'production') {
    return {
      ...ultimoStatusConexao,
      conectado: false,
      mensagem:
        'AVISO: MAPA_WEBHOOK_URL aponta para localhost. O Render na nuvem não consegue contactar a máquina do seu colega em localhost. Use a integração via API Pull (?api_key=...) ou crie um túnel via ngrok.',
      urlDestino: webhookUrl,
      modo: 'desconectado',
    }
  }

  // No modo Pull (sem webhook URL), valida se houve consumo recente
  if (!webhookUrl && ultimoStatusConexao.ultimoConsumoEm) {
    const diffSegundos = Math.round(
      (Date.now() - new Date(ultimoStatusConexao.ultimoConsumoEm).getTime()) / 1000
    )
    if (diffSegundos <= 180) {
      return {
        ...ultimoStatusConexao,
        conectado: true,
        mensagem: `Comunicação PULL ativa. Última consulta pelo Mapa há ${diffSegundos}s (${ultimoStatusConexao.totalConsumos || 1} requisições atendidas).`,
        verificadoEm: new Date().toISOString(),
      }
    } else {
      const min = Math.round(diffSegundos / 60)
      return {
        ...ultimoStatusConexao,
        conectado: false,
        mensagem: `Sem consulta recente do Mapa (último consumo há ${min} min). Verifique se o sistema do colega está a rodar e a requisitar a API.`,
        verificadoEm: new Date().toISOString(),
      }
    }
  }

  return { ...ultimoStatusConexao }
}

export function atualizarStatusConexao(
  status: Partial<StatusConexaoExterna>
): StatusConexaoExterna {
  ultimoStatusConexao = {
    ...ultimoStatusConexao,
    ...status,
    verificadoEm: new Date().toISOString(),
  }
  return ultimoStatusConexao
}

/**
 * Executa o teste ativo de conectividade (handshake ping) com o sistema externo.
 */
export async function testarConexaoSistemaExterno(): Promise<StatusConexaoExterna> {
  const webhookUrl = process.env.MAPA_WEBHOOK_URL || process.env.MAPA_HEALTHCHECK_URL
  const inicio = Date.now()

  // Se não houver webhook configurado, a comunicação funciona via API Pull (/api/v1/integracao/mapa)
  if (!webhookUrl) {
    ultimoStatusConexao = {
      ...ultimoStatusConexao,
      conectado: true,
      latenciaMs: 1,
      mensagem:
        ultimoStatusConexao.ultimoConsumoEm
          ? `Modo API Ativo: Última consulta pelo Mapa há ${Math.round((Date.now() - new Date(ultimoStatusConexao.ultimoConsumoEm).getTime()) / 1000)}s.`
          : 'Modo API Ativo: O canal está pronto e à escuta. O sistema externo pode consumir via GET /api/v1/integracao/mapa.',
      verificadoEm: new Date().toISOString(),
      urlDestino: null,
      modo: 'api_polling',
    }
    return ultimoStatusConexao
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)

    const pingPayload = JSON.stringify({
      evento: 'ping_handshake',
      origem: 'SAAS-Triagem-Maputo',
      timestamp: new Date().toISOString(),
    })
    const assinatura = gerarAssinaturaHmac(pingPayload)

    // Tenta pingar a URL do webhook ou um endpoint /ping derivado
    const pingUrl = webhookUrl.endsWith('/ping')
      ? webhookUrl
      : `${webhookUrl.replace(/\/$/, '')}/ping`

    const response = await fetch(pingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-SHA256': `sha256=${assinatura}`,
        'X-API-Key': getIntegrationApiKey(),
        'User-Agent': 'SAAS-Maputo-HealthCheck/1.0',
      },
      body: pingPayload,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const latencia = Date.now() - inicio

    if (response.ok) {
      ultimoStatusConexao = {
        ...ultimoStatusConexao,
        conectado: true,
        latenciaMs: latencia,
        mensagem: `Comunicação bidirecional ativa com o Mapa de Distribuição (${latencia}ms).`,
        verificadoEm: new Date().toISOString(),
        urlDestino: webhookUrl,
        modo: 'webhook_ativo',
      }
    } else {
      ultimoStatusConexao = {
        ...ultimoStatusConexao,
        conectado: false,
        latenciaMs: latencia,
        mensagem: `Sistema externo respondeu com status HTTP ${response.status}.`,
        verificadoEm: new Date().toISOString(),
        urlDestino: webhookUrl,
        modo: 'desconectado',
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    ultimoStatusConexao = {
      ...ultimoStatusConexao,
      conectado: false,
      latenciaMs: Date.now() - inicio,
      mensagem: `Falha de conexão com o sistema externo: ${msg}`,
      verificadoEm: new Date().toISOString(),
      urlDestino: webhookUrl,
      modo: 'desconectado',
    }
  }

  return ultimoStatusConexao
}
