import { NextResponse } from 'next/server'
import {
  obterStatusConexao,
  testarConexaoSistemaExterno,
} from '@/lib/integracao-externa'

/**
 * Consulta o status atual da comunicação com o sistema externo do Mapa.
 */
export async function GET() {
  const status = obterStatusConexao()
  return NextResponse.json(status, {
    headers: {
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
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
