import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { serverStore } from '@/lib/server-store'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limiteParam = url.searchParams.get('limite')
  const limite = limiteParam ? parseInt(limiteParam, 10) : undefined

  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )
      let query = supabase
        .from('notificacoes')
        .select('*')
        .order('criado_em', { ascending: false })

      if (limite && !isNaN(limite)) {
        query = query.limit(limite)
      } else {
        query = query.limit(100)
      }

      const res = await Promise.race([query, timeoutPromise])
      if ('data' in res && res.data && res.data.length > 0) {
        serverStore.recordSupabaseSuccess()
        return NextResponse.json({ success: true, data: res.data, isFallback: false })
      }
    } catch {
      serverStore.recordSupabaseFailure()
    }
  }

  const todas = serverStore.listarNotificacoes()
  const data = limite && !isNaN(limite) ? todas.slice(0, limite) : todas

  return NextResponse.json({
    success: true,
    data,
    total: todas.length,
    nao_lidas: todas.filter((n) => !n.lida).length,
    isFallback: true,
  })
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, lida = true, todas = false } = body

    if (todas) {
      serverStore.marcarTodasNotificacoesLidas()
      try {
        const supabase = createServiceClient()
        await supabase.from('notificacoes').update({ lida: true }).neq('id', '0')
      } catch {
        // Ignora erro no Supabase se estiver offline
      }
      return NextResponse.json({ success: true, mensagem: 'Todas as notificações foram marcadas como lidas.' })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID da notificação é obrigatório.' }, { status: 400 })
    }

    serverStore.marcarNotificacaoLida(id)

    try {
      const supabase = createServiceClient()
      await supabase.from('notificacoes').update({ lida }).eq('id', id)
    } catch {
      // Ignora erro no Supabase se estiver offline
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
