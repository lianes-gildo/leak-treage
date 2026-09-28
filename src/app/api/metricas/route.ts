import { NextResponse } from 'next/server'
import { calcularTaxaAcerto } from '@/lib/metricas'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dias = parseInt(searchParams.get('dias') || '30')

    const fim = new Date()
    const inicio = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000)

    const metricas = await calcularTaxaAcerto({ inicio, fim })

    return NextResponse.json({ success: true, data: metricas })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na API /api/metricas:', msg)
    return NextResponse.json(
      { error: `Erro ao calcular métricas: ${msg}` },
      { status: 500 }
    )
  }
}
