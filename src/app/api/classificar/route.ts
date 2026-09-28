import { NextResponse } from 'next/server'
import { executarPipelineTriagem } from '@/lib/pipeline-triagem'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ocorrencia_id, forcar_reanalise } = body

    if (!ocorrencia_id || typeof ocorrencia_id !== 'string') {
      return NextResponse.json(
        { error: 'O parâmetro "ocorrencia_id" é obrigatório e deve ser uma string.' },
        { status: 400 }
      )
    }

    const resultado = await executarPipelineTriagem(ocorrencia_id, { forcar_reanalise })

    if (!resultado.success) {
      return NextResponse.json(
        { error: resultado.error || 'Falha no processamento da triagem' },
        { status: resultado.error?.includes('não encontrada') ? 404 : 500 }
      )
    }

    return NextResponse.json(resultado)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API Classificar] Erro inesperado na requisição:', msg)
    return NextResponse.json(
      { error: `Erro interno no servidor: ${msg}` },
      { status: 500 }
    )
  }
}
