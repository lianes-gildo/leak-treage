import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serverStore } from '@/lib/server-store'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('saas_session')?.value

    if (token) {
      serverStore.destruirSessao(token)
    }

    const response = NextResponse.json({
      success: true,
      mensagem: 'Sessão terminada com sucesso.',
    })

    response.cookies.delete('saas_session')

    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao terminar sessão: ${msg}` }, { status: 500 })
  }
}
