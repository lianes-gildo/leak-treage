import { NextResponse } from 'next/server'
import { escalonarOcorrenciasVencidas } from '@/lib/escalonamento'
import { serverStore } from '@/lib/server-store'

/**
 * Endpoint para execução do ciclo de escalonamento de SLA.
 * Pode ser invocado por cron jobs agendados, triggers ou manualmente pelo Dashboard.
 */
export async function POST() {
  try {
    let resultado = { escalonadas: 0, logs: [] as string[] }
    try {
      resultado = await Promise.race([
        escalonarOcorrenciasVencidas(),
        new Promise<{ escalonadas: number; logs: string[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 2000)
        ),
      ])
    } catch {
      // Se o Supabase falhar, escalona no serverStore
      resultado = serverStore.escalonarSLAVencidos()
    }

    if (resultado.escalonadas === 0) {
      const resLocal = serverStore.escalonarSLAVencidos()
      if (resLocal.escalonadas > 0) {
        resultado = resLocal
      }
    }

    return NextResponse.json({
      success: true,
      data: resultado,
      mensagem: `${resultado.escalonadas} ocorrência(s) escalonada(s) por SLA vencido.`,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na rota de escalonamento SLA:', msg)
    return NextResponse.json(
      { error: `Falha ao processar escalonamento SLA: ${msg}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  return POST()
}
