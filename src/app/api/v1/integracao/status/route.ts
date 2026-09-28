import { NextResponse } from 'next/server'
import {
  obterStatusConexao,
  testarConexaoSistemaExterno,
} from '@/lib/integracao-externa'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * Consulta o status atual da comunicação com o sistema externo do Mapa.
 */
export async function GET() {
  const status = obterStatusConexao()
  return NextResponse.json(status, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

/**
 * Dispara um teste ativo de conexão (ping handshake) sob demanda.
 */
export async function POST() {
  const status = await testarConexaoSistemaExterno()
  return NextResponse.json(status, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
