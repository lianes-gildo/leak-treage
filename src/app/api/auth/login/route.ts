import { NextResponse } from 'next/server'
import { serverStore } from '@/lib/server-store'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, role } = body

    let usuario = email ? serverStore.buscarUtilizadorPorEmail(email) : null

    // Se informado papel de demonstração ou utilizador novo
    if (!usuario && role) {
      const todos = serverStore.listarUtilizadores()
      usuario = todos.find((u) => u.papel === role) || todos[0]
    }

    if (!usuario) {
      return NextResponse.json(
        { error: 'Utilizador não encontrado no diretório de segurança SAAS.' },
        { status: 401 }
      )
    }

    if (!usuario.ativo) {
      return NextResponse.json(
        { error: 'Conta de operador suspensa pelo Administrador do Sistema.' },
        { status: 403 }
      )
    }

    // Atualiza último acesso
    serverStore.atualizarUtilizador(usuario.id, {
      ultimo_acesso: new Date().toISOString(),
    })

    const token = serverStore.criarSessao(usuario)

    // Regista evento na auditoria
    serverStore.adicionarAuditoria({
      ocorrencia_id: 'sistema_auth',
      tipo_evento: 'mudanca_status',
      valor_anterior: null,
      valor_novo: { login: true, papel: usuario.papel, ip: 'autorizado' },
      motivo: `Autenticação corporativa com sucesso para ${usuario.nome} (${usuario.papel})`,
      autor: `${usuario.nome} (${usuario.papel})`,
    })

    const response = NextResponse.json({
      success: true,
      mensagem: 'Sessão autenticada com sucesso.',
      usuario,
    })

    // Define cookie de sessão corporativa seguro
    response.cookies.set({
      name: 'saas_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
    })

    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro na autenticação: ${msg}` }, { status: 500 })
  }
}
