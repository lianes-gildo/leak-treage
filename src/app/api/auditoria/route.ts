import { NextResponse } from 'next/server'
import { serverStore } from '@/lib/server-store'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ocorrenciaId = searchParams.get('ocorrencia_id') || undefined
    const autor = searchParams.get('autor') || undefined
    const tipo = searchParams.get('tipo') || undefined

    let logs = serverStore.listarAuditorias(ocorrenciaId)

    if (autor) {
      logs = logs.filter((l) => l.autor.toLowerCase().includes(autor.toLowerCase()))
    }

    if (tipo) {
      logs = logs.filter((l) => l.tipo_evento === tipo)
    }

    return NextResponse.json({ success: true, data: logs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao obter auditoria: ${msg}` }, { status: 500 })
  }
}
