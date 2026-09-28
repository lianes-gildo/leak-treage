import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { classificarOcorrencia } from '@/lib/gemini-classifier'
import { resolverContextoRede, montarPriorityInputComPrecedencia } from '@/lib/gis-resolver'
import { calcularPrioridade } from '@/lib/priority-engine'
import { encontrarOuCriarGrupo, aplicarAmplificacaoPorVolume } from '@/lib/deduplicador'
import { calcularSLALimite } from '@/lib/escalonamento'
import { decidirDespacho } from '@/lib/dispatch-engine'
import { serverStore } from '@/lib/server-store'
import { Ocorrencia, StatusOcorrencia } from '@/types/ocorrencia'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ocorrencia_id } = body

    if (!ocorrencia_id || typeof ocorrencia_id !== 'string') {
      return NextResponse.json(
        { error: 'O parâmetro "ocorrencia_id" é obrigatório e deve ser uma string.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 1. Busca a ocorrência no Supabase ou no repositório resiliente
    let ocorrencia: Ocorrencia | null = null
    if (serverStore.canAttemptSupabase()) {
      try {
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const fetchPromise = supabase.from('ocorrencias').select('*').eq('id', ocorrencia_id).single()
        const res = await Promise.race([fetchPromise, timeoutPromise])
        if ('data' in res && res.data) {
          ocorrencia = res.data as Ocorrencia
          serverStore.recordSupabaseSuccess()
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    if (!ocorrencia) {
      ocorrencia = serverStore.buscarOcorrenciaPorId(ocorrencia_id)
    }

    if (!ocorrencia) {
      return NextResponse.json(
        { error: `Ocorrência não encontrada para o ID fornecido: ${ocorrencia_id}` },
        { status: 404 }
      )
    }

    // 1.1 Verificação de Análise Única (Economia de Tokens da IA)
    // Se a ocorrência já possui uma classificação visual e status definitivo, reutiliza sem gastar novos tokens
    if (
      ocorrencia.classificacao_gemini &&
      ocorrencia.status !== 'pendente' &&
      !body.forcar_reanalise
    ) {
      console.log(`[API Classificar] Ocorrência ${ocorrencia_id} já possui classificação prévia. Reutilizando sem consumir tokens de IA.`)
      return NextResponse.json({
        success: true,
        ocorrencia_id,
        status: ocorrencia.status,
        prioridade: ocorrencia.prioridade,
        reutilizado: true,
        mensagem: 'Classificação prévia preservada com sucesso (consumo zero de tokens adicionais).'
      })
    }

    const contextoFormulario = {
      local_fuga: ocorrencia.local_fuga,
      intensidade_reportada: ocorrencia.intensidade_reportada,
      afeta_outros: ocorrencia.afeta_outros,
    }

    // 2. Integração Gemini 2.5 Flash (Executada rigorosamente 1 única vez por ocorrência)
    console.log(`[API Classificar] 1/6 A executar observação visual Gemini para ocorrência ${ocorrencia_id}...`)
    const classificacao = await classificarOcorrencia(
      ocorrencia.foto_url,
      contextoFormulario
    )

    // CONCORDÂNCIA ROBUSTA DO BACKEND:
    // Se a imagem não for fuga, mas o cidadão indicou conduta principal com jacto e a confiança da visão for baixa (<0.7),
    // o backend previne falso descarte e encaminha para validação humana urgente.
    const suspeitaCriticaMunicipe =
      contextoFormulario.local_fuga === 'conduta' &&
      contextoFormulario.intensidade_reportada === 'jacto' &&
      classificacao.confidence < 0.7

    // REJEIÇÃO DETERMINÍSTICA INSTITUCIONAL (SEM MENÇÃO A IA PARA O CIDADÃO)
    // Uma ocorrência SÓ PODE ser rejeitada automaticamente se a visão computacional tiver
    // analisado com sucesso E tiver certeza clara (confidence >= 0.6) de que a imagem NÃO retrata fuga.
    // Falhas de processamento, tipos desconhecidos ou baixa confiança NUNCA devem ser rejeitados
    // automaticamente; devem continuar pelo pipeline e cair na fila de validação humana.
    const ehDescarteGenuino =
      !classificacao.is_leak &&
      classificacao.confidence >= 0.6 &&
      classificacao.leak_type !== 'desconhecido' &&
      !suspeitaCriticaMunicipe

    if (ehDescarteGenuino) {
      console.log(`[API Classificar] Ocorrência ${ocorrencia_id} REJEITADA: imagem confirmada sem indícios de água/fuga (confiança: ${classificacao.confidence}).`)

      const mensagemInstitucionalRejeicao =
        'Após verificação técnica dos elementos fotográficos e documentais, não foram identificados indícios visíveis de rotura, jacto ou fuga de água na infraestrutura pública sob gestão do SAAS. O registo foi arquivado sem mobilização de piquete operacional. Caso a anomalia persista ou tenha ocorrido um lapso na fotografia, solicitamos novo reporte com imagem nítida da fuga ou contacto com o apoio ao cliente (+258 84 311 0000).'

      const camposAtualizados: Partial<Ocorrencia> = {
        classificacao_gemini: classificacao,
        prioridade_original: null,
        prioridade: null,
        priority_score: 0,
        confidence: classificacao.confidence,
        grupo_id: null,
        status: 'rejeitado',
        motivo_rejeicao: mensagemInstitucionalRejeicao,
        fontes_dados: {
          infraestrutura: 'gemini',
          diametro: 'gemini',
          caudal: 'gemini',
          impacto: 'gemini',
          risco: 'gemini',
        },
        decisao_despacho: {
          acao: 'fila_validacao_humana',
          motivo: `Descarte fundamentado: Ausência de evidências visíveis de anomalia na infraestrutura pública (${classificacao.reason}).`,
        },
        atualizado_em: new Date().toISOString(),
      }

      const updated = serverStore.atualizarOcorrencia(ocorrencia_id, camposAtualizados) || ({
        ...ocorrencia,
        ...camposAtualizados,
      } as Ocorrencia)

      if (serverStore.canAttemptSupabase()) {
        try {
          const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
          )
          await Promise.race([
            supabase.from('ocorrencias').update(camposAtualizados).eq('id', ocorrencia_id),
            timeoutPromise,
          ])
        } catch {
          serverStore.recordSupabaseFailure()
        }
      }

      try {
        const { registrarEvento } = await import('@/lib/auditoria')
        await registrarEvento({
          ocorrencia_id,
          tipo_evento: 'classificacao_inicial',
          valor_anterior: { status: ocorrencia.status },
          valor_novo: { status: 'rejeitado', motivo: mensagemInstitucionalRejeicao },
          motivo: `Arquivado por ausência de evidência de fuga na rede (${classificacao.reason})`,
          autor: 'sistema:triagem_automatica',
        })
      } catch {
        // Continua
      }

      serverStore.adicionarNotificacao({
        destinatario_id: null,
        papel_alvo: 'supervisor',
        ocorrencia_id,
        grupo_id: null,
        tipo: 'nova_urgente',
        titulo: 'Reporte Rejeitado pela IA [Sem Fuga]',
        mensagem: `Ocorrência ${ocorrencia_id.substring(0, 8)}: Análise visual determinou ausência de água/fuga (${classificacao.reason}).`,
        lida: false,
      })

      return NextResponse.json({
        success: true,
        rejeitado: true,
        data: {
          ocorrencia: updated,
          classificacao,
          motivo: classificacao.reason,
          status: 'rejeitado',
        },
      })
    }

    // 3. Camada de Verdade GIS/Cadastro (Resolução Geográfica)
    console.log(`[API Classificar] 2/6 A resolver contexto GIS/Cadastro...`)
    let contextoRede = null
    try {
      contextoRede = await Promise.race([
        resolverContextoRede(ocorrencia.latitude, ocorrencia.longitude),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ])
    } catch (gisErr: unknown) {
      const msg = gisErr instanceof Error ? gisErr.message : String(gisErr)
      console.error('Aviso: Falha no GIS resolver (caiu no fallback Gemini):', msg)
    }

    // 4. Monta PriorityInput aplicando Precedência (GIS > Gemini) e grava fontes_dados
    const { priorityInput, fontesDados } = montarPriorityInputComPrecedencia(
      classificacao,
      contextoFormulario,
      contextoRede
    )

    // 5. Priority Engine (Motor de Regras Determinístico da Fase 1)
    console.log(`[API Classificar] 3/6 A calcular prioridade determinística pelo Priority Engine...`)
    const priorityOutput = calcularPrioridade(priorityInput)
    const prioridadeOriginal = priorityOutput.prioridade

    // 6. Motor de Deduplicação / Agrupamento e Amplificação por Volume
    console.log(`[API Classificar] 4/6 A agrupar ocorrência e verificar deduplicação...`)
    let grupoId: string | null = null
    let quantidadeReportes = 1
    let prioridadeConsolidada = prioridadeOriginal

    try {
      const resGrupo = await Promise.race([
        encontrarOuCriarGrupo(ocorrencia),
        new Promise<{ grupo_id: string; quantidade_reportes: number }>((resolve) =>
          setTimeout(() => resolve({ grupo_id: 'grp-local-01', quantidade_reportes: 1 }), 2000)
        ),
      ])
      grupoId = resGrupo.grupo_id
      quantidadeReportes = resGrupo.quantidade_reportes
      prioridadeConsolidada = aplicarAmplificacaoPorVolume(
        prioridadeOriginal,
        quantidadeReportes
      )
    } catch (dedupErr: unknown) {
      const msg = dedupErr instanceof Error ? dedupErr.message : String(dedupErr)
      console.error('Aviso: Falha na deduplicação (mantém grupo isolado):', msg)
    }

    // 7. Cálculo do Limite de SLA baseado na prioridade consolidada
    console.log(`[API Classificar] 5/6 A calcular SLA e prazo limite...`)
    const dataCriacao = ocorrencia.criado_em ? new Date(ocorrencia.criado_em) : new Date()
    const slaLimite = calcularSLALimite(prioridadeConsolidada, dataCriacao)

    // 8. Motor de Decisão de Despacho (Auto vs Humano)
    console.log(`[API Classificar] 6/6 A avaliar regra de decisão de despacho...`)
    const decisaoDespacho = decidirDespacho({
      prioridade: prioridadeConsolidada,
      necessita_validacao_humana: priorityOutput.necessita_validacao_humana,
      confidence: classificacao.confidence,
      quantidade_reportes: quantidadeReportes,
    })

    const novoStatus: StatusOcorrencia = priorityOutput.necessita_validacao_humana
      ? 'em_validacao'
      : 'pendente'

    // 9. Persistência de todos os novos campos no Supabase e no serverStore
    const camposAtualizados: Partial<Ocorrencia> = {
      classificacao_gemini: classificacao,
      prioridade_original: prioridadeOriginal,
      prioridade: prioridadeConsolidada,
      priority_score: priorityOutput.score,
      confidence: classificacao.confidence,
      grupo_id: grupoId,
      sla_limite: slaLimite.toISOString(),
      fontes_dados: fontesDados,
      decisao_despacho: decisaoDespacho,
      status: novoStatus,
      atualizado_em: new Date().toISOString(),
    }

    let updatedData: Ocorrencia | null = null

    if (serverStore.canAttemptSupabase()) {
      try {
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const updatePromise = supabase
          .from('ocorrencias')
          .update(camposAtualizados)
          .eq('id', ocorrencia_id)
          .select('*, grupo:grupos_ocorrencia(*)')
          .single()

        const res = await Promise.race([updatePromise, timeoutPromise])
        if ('data' in res && res.data) {
          updatedData = res.data as Ocorrencia
          serverStore.recordSupabaseSuccess()
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    // Atualiza sempre no serverStore
    updatedData = serverStore.atualizarOcorrencia(ocorrencia_id, camposAtualizados) || ({
      ...ocorrencia,
      ...camposAtualizados,
    } as Ocorrencia)

    // 10. Trilha de Auditoria & Ativação de Notificações em Tempo Real
    try {
      const { registrarEvento } = await import('@/lib/auditoria')
      await registrarEvento({
        ocorrencia_id,
        tipo_evento: 'classificacao_inicial',
        valor_anterior: {
          prioridade: ocorrencia.prioridade,
          status: ocorrencia.status,
        },
        valor_novo: {
          prioridade: prioridadeConsolidada,
          status: novoStatus,
          score: priorityOutput.score,
          grupo_id: grupoId,
          quantidade_reportes: quantidadeReportes,
          decisao_despacho: decisaoDespacho,
        },
        motivo: priorityOutput.motivo,
        autor: 'sistema:pipeline_triagem',
      })

      if (quantidadeReportes >= 10 || prioridadeConsolidada === 'P1') {
        await registrarEvento({
          ocorrencia_id,
          tipo_evento: 'amplificacao_grupo',
          valor_anterior: { quantidade_reportes: quantidadeReportes - 1, prioridade: prioridadeOriginal },
          valor_novo: { grupo_id: grupoId, quantidade_reportes: quantidadeReportes, prioridade: prioridadeConsolidada },
          motivo: `Grupo amplificado por volume (${quantidadeReportes} reportes no mesmo raio de 50m).`,
          autor: 'sistema:deduplicador',
        })
      }
    } catch (auditErr: unknown) {
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr)
      console.error('Aviso: Falha ao registar auditoria da triagem:', msg)
    }

    // Garante notificação no serverStore para visualização imediata
    serverStore.adicionarNotificacao({
      destinatario_id: null,
      papel_alvo: 'supervisor',
      ocorrencia_id,
      grupo_id: grupoId,
      tipo: 'nova_urgente',
      titulo: `Nova Ocorrência Urgente [${prioridadeConsolidada}]`,
      mensagem: `Ocorrência ${ocorrencia_id.substring(0, 8)} triada como ${prioridadeConsolidada}. Motivo: ${priorityOutput.motivo}`,
      lida: false,
    })

    console.log(
      `[API Classificar] Ocorrência ${ocorrencia_id} triada: ${prioridadeConsolidada} (Original: ${prioridadeOriginal}, Score: ${priorityOutput.score}, Grupo: ${grupoId}, Reportes: ${quantidadeReportes}, Despacho: ${decisaoDespacho.acao})`
    )

    return NextResponse.json({
      success: true,
      data: {
        ocorrencia: updatedData,
        contextoRede,
        classificacao,
        fontesDados,
        priorityInput,
        priorityOutput,
        prioridadeConsolidada,
        quantidadeReportes,
        slaLimite: slaLimite.toISOString(),
        decisaoDespacho,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API Classificar] Erro inesperado no pipeline da Fase 2:', msg)
    return NextResponse.json(
      { error: `Erro interno no servidor: ${msg}` },
      { status: 500 }
    )
  }
}
