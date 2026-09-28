import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serverStore } from '@/lib/server-store'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('saas_session')?.value
    const usuario = token ? serverStore.validarSessao(token) : null

    return NextResponse.json({
      success: !!usuario,
      usuario: usuario || null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao obter perfil: ${msg}` }, { status: 500 })
  }
}
