import { NextResponse } from 'next/server'
import { serverStore } from '@/lib/server-store'

export async function GET() {
  try {
    const equipas = serverStore.listarEquipas()
    return NextResponse.json({ success: true, data: equipas })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao listar equipas: ${msg}` }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, lider, viatura, contacto, zona_cobertura, tipos_infraestrutura, membros_ativos } = body

    if (!nome || !lider) {
      return NextResponse.json(
        { error: 'Nome da equipa e líder de piquete são obrigatórios.' },
        { status: 400 }
      )
    }

    const novaEquipa = serverStore.adicionarEquipa({
      nome,
      lider,
      viatura: viatura || 'Viatura Operacional SAAS',
      contacto: contacto || '+258 84 000 0000',
      zona_cobertura: zona_cobertura || 'Grande Maputo',
      tipos_infraestrutura: Array.isArray(tipos_infraestrutura) ? tipos_infraestrutura : ['secundaria', 'residencial'],
      membros_ativos: Number(membros_ativos) || 3,
      ativa: true,
    })

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'gestao_equipas',
      tipo_evento: 'atribuicao_equipa',
      valor_anterior: null,
      valor_novo: novaEquipa,
      motivo: `Criação da equipa operacional: ${novaEquipa.nome}`,
      autor: 'Supervisor Central SAAS',
    })

    return NextResponse.json({ success: true, data: novaEquipa }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao adicionar equipa: ${msg}` }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...campos } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da equipa é obrigatório.' }, { status: 400 })
    }

    const equipaAtualizada = serverStore.atualizarEquipa(id, campos)
    if (!equipaAtualizada) {
      return NextResponse.json({ error: 'Equipa não encontrada.' }, { status: 404 })
    }

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'gestao_equipas',
      tipo_evento: 'mudanca_status',
      valor_anterior: { id },
      valor_novo: campos,
      motivo: `Atualização dos parâmetros da equipa ${equipaAtualizada.nome}`,
      autor: 'Supervisor Central SAAS',
    })

    return NextResponse.json({ success: true, data: equipaAtualizada })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao atualizar equipa: ${msg}` }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID da equipa é obrigatório.' }, { status: 400 })
    }

    const removida = serverStore.removerEquipa(id)
    if (!removida) {
      return NextResponse.json({ error: 'Equipa não encontrada ou já removida.' }, { status: 404 })
    }

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'gestao_equipas',
      tipo_evento: 'mudanca_status',
      valor_anterior: { id },
      valor_novo: { removida: true },
      motivo: `Remoção de equipa operacional do cadastro ativo`,
      autor: 'Supervisor Central SAAS',
    })

    return NextResponse.json({ success: true, mensagem: 'Equipa removida com sucesso.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao remover equipa: ${msg}` }, { status: 500 })
  }
}
