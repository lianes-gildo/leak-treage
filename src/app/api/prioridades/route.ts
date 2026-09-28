import { NextResponse } from 'next/server'
import { serverStore } from '@/lib/server-store'
import { Prioridade } from '@/types/ocorrencia'

export async function GET() {
  try {
    const matriz = serverStore.listarMatrizPrioridades()
    return NextResponse.json({ success: true, data: matriz })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao obter matriz de prioridades: ${msg}` }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { prioridade, ...campos } = body

    if (!prioridade) {
      return NextResponse.json({ error: 'Nível de prioridade (P1-P5) é obrigatório.' }, { status: 400 })
    }

    const atualizada = serverStore.atualizarMatrizPrioridade(prioridade as Prioridade, campos)
    if (!atualizada) {
      return NextResponse.json({ error: 'Nível de prioridade não encontrado.' }, { status: 404 })
    }

    serverStore.adicionarAuditoria({
      ocorrencia_id: 'matriz_sla',
      tipo_evento: 'mudanca_status',
      valor_anterior: { prioridade },
      valor_novo: campos,
      motivo: `Ajuste na política de SLA para nível ${prioridade}`,
      autor: 'Direção Operacional SAAS',
    })

    return NextResponse.json({ success: true, data: atualizada })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro ao atualizar matriz de prioridades: ${msg}` }, { status: 500 })
  }
}
