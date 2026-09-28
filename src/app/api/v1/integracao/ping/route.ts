import { NextResponse } from 'next/server'
import {
  verificarApiKeyIntegracao,
  verificarAssinaturaHmac,
  registrarAtividadeIntegracao,
} from '@/lib/integracao-externa'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-API-Key, X-Signature-SHA256, X-Timestamp, X-Idempotency-Key',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * Endpoint de Recepção de Ping / Handshake para o Sistema Externo (Mapa de Distribuição).
 * Permite ao sistema externo confirmar que o gateway de triagem está online e comunicando.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  const queryApiKey =
    searchParams.get('api_key') || searchParams.get('token') || searchParams.get('key')

  // O ping pode ser autenticado por API key (header ou query)
  const autenticado = verificarApiKeyIntegracao(authHeader, apiKeyHeader, queryApiKey)

  // Regista atividade ativa para comutação do badge verde
  registrarAtividadeIntegracao(
    'ping',
    autenticado
      ? 'Handshake autenticado recebido com sucesso do sistema externo.'
      : 'Handshake anónimo recebido do sistema externo (chave não fornecida ou inválida).'
  )

  return NextResponse.json(
    {
      status: 'ok',
      servico: 'SAAS-Triagem-Maputo',
      autenticado,
      timestamp: new Date().toISOString(),
      mensagem: autenticado
        ? 'Gateway de Triagem operacional e autenticado com sucesso.'
        : 'Gateway de Triagem operacional (chave de API ausente ou inválida).',
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  const queryApiKey =
    searchParams.get('api_key') || searchParams.get('token') || searchParams.get('key')
  const signatureHeader = request.headers.get('x-signature-sha256')

  let bodyText = ''
  try {
    bodyText = await request.text()
  } catch {
    bodyText = ''
  }

  let hmacValido = false
  if (signatureHeader && bodyText) {
    hmacValido = verificarAssinaturaHmac(bodyText, signatureHeader)
  }

  const apiKeyValida = verificarApiKeyIntegracao(authHeader, apiKeyHeader, queryApiKey)

  registrarAtividadeIntegracao(
    'ping',
    'Handshake ativo recebido via POST do sistema externo.'
  )

  return NextResponse.json(
    {
      status: 'ok',
      servico: 'SAAS-Triagem-Maputo',
      apiKeyValida,
      hmacValido,
      timestamp: new Date().toISOString(),
      mensagem: 'Handshake bidirecional confirmado com sucesso.',
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
