import { NextResponse } from 'next/server'
import { serverStore } from '@/lib/server-store'

export async function GET() {
  try {
    const utilizadores = serverStore.listarUtilizadores()
    return NextResponse.json({ success: true, data: utilizadores })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao listar utilizadores: ${msg}` }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, email, papel, departamento, telefone } = body

    if (!nome || !email || !papel) {
      return NextResponse.json(
        { error: 'Nome, e-mail institucional e papel (role) são obrigatórios.' },
        { status: 400 }
      )
    }

    const existente = serverStore.buscarUtilizadorPorEmail(email)
    if (existente) {
      return NextResponse.json(
        { error: 'Já existe um operador registado com este e-mail corporativo.' },
        { status: 409 }
      )
    }

    const novo = serverStore.adicionarUtilizador({
      nome,
      email,
      papel,
      departamento: departamento || 'Centro de Operações SAAS',
      telefone: telefone || '+258 84 000 0000',
      ativo: true,
    })

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'seguranca_rbac',
      tipo_evento: 'mudanca_status',
      valor_anterior: null,
      valor_novo: novo,
      motivo: `Registo de novo operador corporativo: ${novo.nome} com perfil ${novo.papel}`,
      autor: 'Administrador SAAS',
    })

    return NextResponse.json({ success: true, data: novo }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao adicionar utilizador: ${msg}` }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...campos } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do utilizador é obrigatório.' }, { status: 400 })
    }

    const anterior = serverStore.buscarUtilizadorPorId(id)
    if (!anterior) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 })
    }

    const atualizado = serverStore.atualizarUtilizador(id, campos)

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'seguranca_rbac',
      tipo_evento: 'mudanca_status',
      valor_anterior: { nome: anterior.nome, papel: anterior.papel, ativo: anterior.ativo },
      valor_novo: campos,
      motivo: `Alteração de perfil/role de operador: ${atualizado?.nome} (${atualizado?.papel})`,
      autor: 'Administrador SAAS',
    })

    return NextResponse.json({ success: true, data: atualizado })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao atualizar utilizador: ${msg}` }, { status: 500 })
  }
}
