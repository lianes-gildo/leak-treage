import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import {
  validarImagemSubmissao,
  verificarRateLimitContacto,
  detectarDuplicidadeMesmoContacto,
} from '@/lib/validacao-submissao'
import { serverStore } from '@/lib/server-store'
import { Ocorrencia } from '@/types/ocorrencia'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      foto_url,
      mime_type = 'image/jpeg',
      tamanho_bytes = 500 * 1024,
      latitude,
      longitude,
      local_fuga,
      agua_saindo_agora,
      intensidade_reportada,
      afeta_outros,
      contacto_cliente,
      observacoes_cliente,
      tipo_pavimento,
      risco_acidente,
    } = body

    // 1. Validação de presença obrigatória de Foto e Contacto
    if (!foto_url || typeof foto_url !== 'string') {
      return NextResponse.json(
        { error: 'A imagem da fuga é obrigatória para submeter a ocorrência.' },
        { status: 400 }
      )
    }

    if (!contacto_cliente || typeof contacto_cliente !== 'string' || !contacto_cliente.trim()) {
      return NextResponse.json(
        { error: 'O número de telefone ou e-mail de contacto é obrigatório.' },
        { status: 400 }
      )
    }

    // 2. Validação técnica de Imagem
    const valImagem = validarImagemSubmissao(mime_type, tamanho_bytes)
    if (!valImagem.valido) {
      return NextResponse.json({ error: valImagem.erro }, { status: 400 })
    }

    // 3. Rate Limiting por contacto (Máximo 5 submissões em 60 minutos)
    let dentroDoLimit = true
    try {
      dentroDoLimit = await Promise.race([
        verificarRateLimitContacto(contacto_cliente),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2000)),
      ])
    } catch {
      dentroDoLimit = true
    }

    if (!dentroDoLimit) {
      return NextResponse.json(
        {
          error:
            'Excedeu o limite temporário de submissões (máximo 5 reportes por hora). Por favor aguarde antes de tentar novamente.',
        },
        { status: 429 }
      )
    }

    // 4. Detecção de Duplicidade do Mesmo Utilizador (<20m e <10 minutos)
    let dupCheck: { isDuplicate: boolean; existingOccurrenceId?: string } = { isDuplicate: false }
    try {
      dupCheck = await Promise.race([
        detectarDuplicidadeMesmoContacto(
          contacto_cliente,
          latitude !== undefined ? Number(latitude) : null,
          longitude !== undefined ? Number(longitude) : null
        ),
        new Promise<{ isDuplicate: boolean; existingOccurrenceId?: string }>((resolve) =>
          setTimeout(() => resolve({ isDuplicate: false }), 2000)
        ),
      ])
    } catch {
      dupCheck = { isDuplicate: false, existingOccurrenceId: undefined }
    }

    if (dupCheck.isDuplicate && dupCheck.existingOccurrenceId) {
      const protocoloFormatado = `PROT-${dupCheck.existingOccurrenceId.substring(0, 8).toUpperCase()}`
      return NextResponse.json({
        success: true,
        mensagem: 'O seu reporte foi associado como reforço a uma ocorrência já registada.',
        protocolo: protocoloFormatado,
        ocorrencia_id: dupCheck.existingOccurrenceId,
        reforco: true,
      })
    }

    // 5. Tentativa de inserção no Supabase com timeout de 2.5 segundos
    const novoId = `oc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const novaOcorrenciaBase: Ocorrencia = {
      id: novoId,
      cliente_id: null,
      foto_url,
      latitude: latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== undefined ? Number(longitude) : null,
      local_fuga: local_fuga || 'outro',
      agua_saindo_agora: agua_saindo_agora ?? true,
      intensidade_reportada: intensidade_reportada || 'pequeno_fluxo',
      afeta_outros: afeta_outros || 'nao',
      contacto_cliente: contacto_cliente.trim(),
      observacoes_cliente: observacoes_cliente || null,
      tipo_pavimento: tipo_pavimento || null,
      risco_acidente: risco_acidente ?? null,
      status: 'pendente',
      classificacao_gemini: null,
      prioridade: null,
      priority_score: null,
      confidence: null,
      validado_por: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }

    let ocorrenciaCriadaId = novoId
    let persistidoNoSupabase = false

    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 2500)
      )
      const insertPromise = supabase
        .from('ocorrencias')
        .insert([novaOcorrenciaBase])
        .select()
        .single()

      const res = await Promise.race([insertPromise, timeoutPromise])
      if ('data' in res && res.data) {
        ocorrenciaCriadaId = res.data.id
        persistidoNoSupabase = true
      }
    } catch (dbErr: unknown) {
      console.warn('Aviso: Supabase inacessível (DNS/Pausado). A registar em serverStore resiliente:', dbErr)
    }

    // Salva sempre no serverStore local para acesso imediato
    novaOcorrenciaBase.id = ocorrenciaCriadaId
    serverStore.salvarOcorrencia(novaOcorrenciaBase)

    // 6. Disparo da Triagem (Classificação)
    try {
      const origin = new URL(request.url).origin
      fetch(`${origin}/api/classificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocorrencia_id: ocorrenciaCriadaId }),
      }).catch((err) => console.error('Aviso: Erro assíncrono na triagem:', err))
    } catch (e) {
      console.error('Falha ao disparar triagem assíncrona:', e)
    }

    const protocolo = `PROT-${ocorrenciaCriadaId.substring(0, 8).toUpperCase()}`

    return NextResponse.json({
      success: true,
      mensagem: 'Ocorrência de fuga de água registada com sucesso.',
      protocolo,
      ocorrencia_id: ocorrenciaCriadaId,
      persistido_remoto: persistidoNoSupabase,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na submissão pública:', msg)
    return NextResponse.json(
      { error: `Erro interno no servidor: ${msg}` },
      { status: 500 }
    )
  }
}

/**
 * Consulta pública de ocorrência por Protocolo ou ID para acompanhamento do cidadão,
 * ou listagem geral para a Consola de Triagem.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const protocoloParam = searchParams.get('protocolo')
    const idParam = searchParams.get('id')

    // CASO 1: Listagem Geral (para o Dashboard)
    if (!protocoloParam && !idParam) {
      if (serverStore.canAttemptSupabase()) {
        try {
          const supabase = createServiceClient()
          const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
          )
          const dbPromise = supabase
            .from('ocorrencias')
            .select('*, cliente:clientes(*), grupo:grupos_ocorrencia(*)')
            .order('criado_em', { ascending: false })

          const res = await Promise.race([dbPromise, timeoutPromise])
          if ('data' in res && res.data) {
            serverStore.recordSupabaseSuccess()
            return NextResponse.json({ success: true, data: res.data, isFallback: false })
          }
        } catch {
          serverStore.recordSupabaseFailure()
        }
      }

      // Fallback resiliente instantâneo (<1ms)
      return NextResponse.json({
        success: true,
        data: serverStore.listarOcorrencias(),
        isFallback: true,
        aviso: 'Servidor Supabase remoto em modo de espera/resiliente. Store em memória ativo.',
      })
    }

    // CASO 2: Consulta por Protocolo ou ID (para o Cidadão)
    const cleanProto = (protocoloParam || '').replace(/^PROT-/i, '').toLowerCase()

    // 1. Tenta buscar no serverStore primeiro (instantâneo)
    const itemLocal = serverStore.buscarOcorrenciaPorId(idParam || cleanProto)
    if (itemLocal) {
      const isFotoExpirada =
        itemLocal.foto_expirada ||
        itemLocal.foto_url === 'retencao_expirada_48h' ||
        Date.now() - new Date(itemLocal.criado_em).getTime() > 48 * 60 * 60 * 1000

      const motivoInstitucional =
        itemLocal.status === 'rejeitado'
          ? itemLocal.motivo_rejeicao?.includes('SAAS')
            ? itemLocal.motivo_rejeicao
            : 'Após verificação técnica dos elementos fotográficos e documentais, não foram identificados indícios visíveis de rotura, jacto ou fuga de água na infraestrutura pública sob gestão do SAAS. O registo foi arquivado sem mobilização de piquete operacional. Caso a anomalia persista ou tenha ocorrido um lapso na fotografia, solicitamos novo reporte com imagem nítida da fuga ou contacto com o apoio ao cliente (+258 84 311 0000).'
          : null

      return NextResponse.json({
        success: true,
        data: {
          protocolo: `PROT-${itemLocal.id.substring(0, 8).toUpperCase()}`,
          id: itemLocal.id,
          status: itemLocal.status,
          prioridade: itemLocal.prioridade,
          motivo_rejeicao: motivoInstitucional,
          foto_url: isFotoExpirada ? null : itemLocal.foto_url,
          foto_expirada: isFotoExpirada,
          local_fuga: itemLocal.local_fuga,
          intensidade_reportada: itemLocal.intensidade_reportada,
          agua_saindo_agora: itemLocal.agua_saindo_agora,
          afeta_outros: itemLocal.afeta_outros,
          tipo_pavimento: itemLocal.tipo_pavimento || null,
          risco_acidente: itemLocal.risco_acidente || false,
          observacoes_cliente: itemLocal.observacoes_cliente || null,
          equipa_atribuida: itemLocal.equipa_atribuida || null,
          sla_limite: itemLocal.sla_limite || null,
          criado_em: itemLocal.criado_em,
          atualizado_em: itemLocal.atualizado_em,
        },
      })
    }

    // 2. Tenta buscar no Supabase com circuit breaker
    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = createServiceClient()
        let query = supabase
          .from('ocorrencias')
          .select('id, status, prioridade, criado_em, atualizado_em, local_fuga, intensidade_reportada, agua_saindo_agora, afeta_outros, tipo_pavimento, risco_acidente, observacoes_cliente, equipa_atribuida, motivo_rejeicao, foto_url, foto_expirada, sla_limite')

        if (idParam) {
          query = query.eq('id', idParam)
        } else if (protocoloParam) {
          query = query.ilike('id', `${cleanProto}%`)
        }

        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const res = await Promise.race([query.maybeSingle(), timeoutPromise])

        if ('data' in res && res.data) {
          serverStore.recordSupabaseSuccess()
          const row = res.data as Record<string, unknown>
          const criadoEm = String(row.criado_em || '')
          const isFotoExpirada =
            Boolean(row.foto_expirada) ||
            row.foto_url === 'retencao_expirada_48h' ||
            Date.now() - new Date(criadoEm).getTime() > 48 * 60 * 60 * 1000

          const motivoOriginal = String(row.motivo_rejeicao || '')
          const motivoInstitucional =
            row.status === 'rejeitado'
              ? motivoOriginal.includes('SAAS')
                ? motivoOriginal
                : 'Após verificação técnica dos elementos fotográficos e documentais, não foram identificados indícios visíveis de rotura, jacto ou fuga de água na infraestrutura pública sob gestão do SAAS. O registo foi arquivado sem mobilização de piquete operacional. Caso a anomalia persista ou tenha ocorrido um lapso na fotografia, solicitamos novo reporte com imagem nítida da fuga ou contacto com o apoio ao cliente (+258 84 311 0000).'
              : null

          return NextResponse.json({
            success: true,
            data: {
              protocolo: `PROT-${String(row.id).substring(0, 8).toUpperCase()}`,
              id: String(row.id),
              status: String(row.status || 'pendente'),
              prioridade: (row.prioridade as string) || null,
              motivo_rejeicao: motivoInstitucional,
              foto_url: isFotoExpirada ? null : (row.foto_url as string) || null,
              foto_expirada: isFotoExpirada,
              local_fuga: (row.local_fuga as string) || null,
              intensidade_reportada: (row.intensidade_reportada as string) || null,
              agua_saindo_agora: (row.agua_saindo_agora as boolean) ?? null,
              afeta_outros: (row.afeta_outros as string) || null,
              tipo_pavimento: (row.tipo_pavimento as string) || null,
              risco_acidente: Boolean(row.risco_acidente),
              observacoes_cliente: (row.observacoes_cliente as string) || null,
              equipa_atribuida: (row.equipa_atribuida as string) || null,
              sla_limite: (row.sla_limite as string) || null,
              criado_em: criadoEm,
              atualizado_em: String(row.atualizado_em || ''),
            },
          })
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    return NextResponse.json(
      { error: 'Ocorrência não localizada para o protocolo fornecido.' },
      { status: 404 }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Erro na consulta: ${msg}` }, { status: 500 })
  }
}

/**
 * Atualização e validação de ocorrência (validação manual pelo operador e atribuição de equipa).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      prioridade,
      status = 'validado',
      validado_por,
      equipa_atribuida,
      motivo_descarte,
      motivo_rejeicao,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da ocorrência é obrigatório.' }, { status: 400 })
    }

    const agoraIso = new Date().toISOString()
    const isDescarte = status === 'rejeitado'
    const motivoFinal = motivo_descarte || motivo_rejeicao || (isDescarte ? 'Descarte operacional — fora de âmbito da rede' : null)

    const campos: Partial<Ocorrencia> = {
      prioridade: prioridade || undefined,
      status,
      validado_por: validado_por || 'operador',
      equipa_atribuida: equipa_atribuida || null,
      atribuido_em: equipa_atribuida ? agoraIso : null,
      motivo_rejeicao: motivoFinal,
      motivo_descarte: motivoFinal,
      enviado_mapa_externo: !isDescarte,
      enviado_mapa_em: !isDescarte ? agoraIso : null,
      atualizado_em: agoraIso,
    }

    // 1. Atualiza no serverStore
    const itemAtualizado = serverStore.atualizarOcorrencia(id, campos)

    // 2. Se validado, despacha para o sistema externo (Mapa de Distribuição)
    let despachoResultado = null
    if (!isDescarte && itemAtualizado) {
      try {
        const { despacharWebhookMapa } = await import('@/lib/integracao-externa')
        despachoResultado = await despacharWebhookMapa(itemAtualizado)
      } catch (err) {
        console.error('Falha no despacho de integração externa:', err)
      }
    }

    // 3. Grava auditoria de validação ou descarte no servidor
    try {
      const { registrarEvento } = await import('@/lib/auditoria')
      await registrarEvento({
        ocorrencia_id: id,
        tipo_evento: 'correcao_manual',
        valor_novo: { prioridade, status, equipa_atribuida, motivo_descarte: motivoFinal },
        motivo: isDescarte
          ? `Ocorrência descartada por ${validado_por || 'operador'}: ${motivoFinal}`
          : `Validação confirmada e despachada para o mapa por ${validado_por || 'operador'}`,
        autor: validado_por || 'operador',
      })
    } catch {
      // Continua
    }

    // 4. Grava feedback de validação se não for descarte
    if (!isDescarte) {
      try {
        const { registrarFeedbackValidacao } = await import('@/lib/metricas')
        await registrarFeedbackValidacao({
          ocorrencia_id: id,
          prioridade_sugerida: prioridade || 'P3',
          prioridade_confirmada: prioridade || 'P3',
          validado_por: validado_por || 'operador',
        })
      } catch {
        // Continua
      }
    }

    // 5. Tenta atualizar no Supabase com circuit breaker
    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = createServiceClient()
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        await Promise.race([
          supabase.from('ocorrencias').update(campos).eq('id', id),
          timeoutPromise,
        ])
        serverStore.recordSupabaseSuccess()
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    return NextResponse.json({
      success: true,
      data: campos,
      integracao_externa: despachoResultado,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * Remoção de ocorrência individual ou limpeza completa da fila operacional.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all') === 'true'

    if (all) {
      serverStore.limparOcorrencias()
      if (serverStore.canAttemptSupabase()) {
        try {
          const supabase = createServiceClient()
          await supabase.from('ocorrencias').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        } catch {
          // ignora
        }
      }

      // Registar evento de auditoria
      serverStore.adicionarAuditoria({
        ocorrencia_id: 'sistema_fila',
        tipo_evento: 'mudanca_status',
        valor_anterior: null,
        valor_novo: { acao: 'limpeza_completa' },
        motivo: 'Limpeza geral da fila de triagem operacional executada pelo operador',
        autor: 'operador_senior',
      })

      return NextResponse.json({
        success: true,
        mensagem: 'Todas as ocorrências foram removidas da fila de triagem com sucesso.',
      })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID da ocorrência é obrigatório.' }, { status: 400 })
    }

    const removida = serverStore.removerOcorrencia(id)

    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = createServiceClient()
        await supabase.from('ocorrencias').delete().eq('id', id)
      } catch {
        // ignora
      }
    }

    // Registar evento de auditoria
    serverStore.adicionarAuditoria({
      ocorrencia_id: id,
      tipo_evento: 'mudanca_status',
      valor_anterior: null,
      valor_novo: { removido: true },
      motivo: `Ocorrência ${id.substring(0, 8)} removida da fila operacional`,
      autor: 'operador_senior',
    })

    return NextResponse.json({
      success: true,
      removida,
      mensagem: `Ocorrência ${id.substring(0, 8)} removida com sucesso.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
