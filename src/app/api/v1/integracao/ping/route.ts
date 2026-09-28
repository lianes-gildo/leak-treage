import { NextResponse } from 'next/server'
import {
  verificarApiKeyIntegracao,
  verificarAssinaturaHmac,
  atualizarStatusConexao,
} from '@/lib/integracao-externa'

/**
 * Endpoint de Recepção de Ping / Handshake para o Sistema Externo (Mapa de Distribuição).
 * Permite ao sistema externo confirmar que o gateway de triagem está online e comunicando.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  // O ping pode ser autenticado por API key
  const autenticado = verificarApiKeyIntegracao(authHeader, apiKeyHeader)

  atualizarStatusConexao({
    conectado: true,
    mensagem: 'Handshake recebido com sucesso do sistema externo.',
    modo: 'webhook_ativo',
  })

  return NextResponse.json(
    {
      status: 'ok',
      servico: 'SAAS-Triagem-Maputo',
      autenticado,
      timestamp: new Date().toISOString(),
      mensagem: 'Gateway de Triagem operacional e comunicando.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
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

  const apiKeyValida = verificarApiKeyIntegracao(authHeader, apiKeyHeader)

  atualizarStatusConexao({
    conectado: true,
    mensagem: 'Handshake ativo recebido via POST do sistema externo.',
    modo: 'webhook_ativo',
  })

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
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
