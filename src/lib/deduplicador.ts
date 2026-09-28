import { createServiceClient } from '@/lib/supabase-server'
import { serverStore } from '@/lib/server-store'
import { Ocorrencia, Prioridade, GrupoOcorrencia } from '@/types/ocorrencia'
import { calcularDistanciaHaversineMetros } from '@/lib/gis-resolver'

/**
 * Janela temporal máxima (em horas) para considerar ocorrências no mesmo grupo.
 */
export const JANELA_DEDUPLICACAO_HORAS = 6

/**
 * Raio de tolerância (em metros) para agrupamento geográfico de ocorrências.
 */
export const RAIO_DEDUPLICACAO_METROS = 50

/**
 * Aplica a regra de negócio de amplificação de prioridade consolidada por volume de reportes.
 * 
 * Regra:
 * - quantidade_reportes >= 10 -> P1 (piso de prioridade máxima)
 * - quantidade_reportes >= 5  -> P2 (piso de alta prioridade)
 * - caso contrário           -> mantém a prioridade calculada original
 */
export function aplicarAmplificacaoPorVolume(
  prioridadeCalculada: Prioridade,
  quantidadeReportes: number
): Prioridade {
  if (quantidadeReportes >= 10) {
    return 'P1'
  }

  if (quantidadeReportes >= 5) {
    // P1 continua P1; P3/P4/P5 sobem para P2
    if (prioridadeCalculada === 'P1') return 'P1'
    return 'P2'
  }

  return prioridadeCalculada
}

interface MockStoreDeduplicacao {
  ocorrenciasExistentes: Ocorrencia[]
  gruposExistentes: GrupoOcorrencia[]
}

/**
 * Encontra um grupo existente nas proximidades ou cria um novo grupo de ocorrências.
 */
export async function encontrarOuCriarGrupo(
  ocorrencia: Ocorrencia,
  mockStore?: MockStoreDeduplicacao
): Promise<{ grupo_id: string; quantidade_reportes: number }> {
  const { latitude, longitude, criado_em } = ocorrencia

  if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
    // Se não houver coordenadas, cria grupo isolado de 1 reporte
    return criarNovoGrupo(ocorrencia.prioridade || 'P3', 1, mockStore)
  }

  const dataAtual = criado_em ? new Date(criado_em) : new Date()
  const dataLimite = new Date(dataAtual.getTime() - JANELA_DEDUPLICACAO_HORAS * 60 * 60 * 1000)

  let ocorrenciasCandidatas: Ocorrencia[] = []

  if (mockStore) {
    ocorrenciasCandidatas = mockStore.ocorrenciasExistentes.filter((o) => {
      if (o.id === ocorrencia.id || o.status === 'resolvido') return false
      const dataCriacao = new Date(o.criado_em)
      return dataCriacao >= dataLimite
    })
  } else {
    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = createServiceClient()
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const fetchPromise = supabase
          .from('ocorrencias')
          .select('*')
          .neq('status', 'resolvido')
          .neq('id', ocorrencia.id)
          .gte('criado_em', dataLimite.toISOString())

        const res = await Promise.race([fetchPromise, timeoutPromise])
        if ('data' in res && res.data && res.data.length > 0) {
          ocorrenciasCandidatas = res.data as Ocorrencia[]
          serverStore.recordSupabaseSuccess()
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    if (ocorrenciasCandidatas.length === 0) {
      ocorrenciasCandidatas = serverStore.listarOcorrencias().filter((o) => {
        if (o.id === ocorrencia.id || o.status === 'resolvido' || o.status === 'rejeitado') return false
        const dataCriacao = new Date(o.criado_em)
        return dataCriacao >= dataLimite
      })
    }
  }

  // Procura ocorrências dentro do raio de 50m
  let grupoExistenteEncontradoId: string | null = null
  let ocorrenciaProximaSemGrupo: Ocorrencia | null = null

  for (const cand of ocorrenciasCandidatas) {
    if (cand.latitude === null || cand.longitude === null) continue
    const dist = calcularDistanciaHaversineMetros(
      latitude,
      longitude,
      Number(cand.latitude),
      Number(cand.longitude)
    )

    if (dist <= RAIO_DEDUPLICACAO_METROS) {
      if (cand.grupo_id) {
        grupoExistenteEncontradoId = cand.grupo_id
        break
      } else if (!ocorrenciaProximaSemGrupo) {
        ocorrenciaProximaSemGrupo = cand
      }
    }
  }

  // CASO A: Encontrou um grupo existente -> Associa e incrementa quantidade_reportes
  if (grupoExistenteEncontradoId) {
    return incrementarGrupoExistente(grupoExistenteEncontradoId, mockStore)
  }

  // CASO B: Encontrou ocorrência próxima sem grupo -> Cria grupo com ambas (2 reportes)
  if (ocorrenciaProximaSemGrupo) {
    const resGrupo = await criarNovoGrupo(ocorrencia.prioridade || 'P3', 2, mockStore)
    
    // Atualiza a ocorrência antiga para pertencer ao novo grupo
    if (!mockStore) {
      const supabase = createServiceClient()
      await supabase
        .from('ocorrencias')
        .update({ grupo_id: resGrupo.grupo_id })
        .eq('id', ocorrenciaProximaSemGrupo.id)
    } else {
      ocorrenciaProximaSemGrupo.grupo_id = resGrupo.grupo_id
    }

    return resGrupo
  }

  // CASO C: Nenhuma ocorrência próxima encontrada -> Cria novo grupo isolado (1 reporte)
  return criarNovoGrupo(ocorrencia.prioridade || 'P3', 1, mockStore)
}

async function criarNovoGrupo(
  prioridadeInicial: Prioridade,
  quantidadeInicial: number,
  mockStore?: MockStoreDeduplicacao
): Promise<{ grupo_id: string; quantidade_reportes: number }> {
  if (mockStore) {
    const novoId = `grupo-${mockStore.gruposExistentes.length + 1}`
    const novoGrupo: GrupoOcorrencia = {
      id: novoId,
      prioridade_consolidada: prioridadeInicial,
      quantidade_reportes: quantidadeInicial,
      raio_metros: RAIO_DEDUPLICACAO_METROS,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }
    mockStore.gruposExistentes.push(novoGrupo)
    return { grupo_id: novoId, quantidade_reportes: quantidadeInicial }
  }

  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )
      const insertPromise = supabase
        .from('grupos_ocorrencia')
        .insert([
          {
            prioridade_consolidada: prioridadeInicial,
            quantidade_reportes: quantidadeInicial,
            raio_metros: RAIO_DEDUPLICACAO_METROS,
          },
        ])
        .select()
        .single()

      const res = await Promise.race([insertPromise, timeoutPromise])
      if ('data' in res && res.data) {
        serverStore.recordSupabaseSuccess()
        return { grupo_id: res.data.id, quantidade_reportes: res.data.quantidade_reportes }
      }
    } catch {
      serverStore.recordSupabaseFailure()
    }
  }

  // Fallback gracioso imediato
  const fallbackId = `grp-${Date.now().toString(36)}`
  return { grupo_id: fallbackId, quantidade_reportes: quantidadeInicial }
}

async function incrementarGrupoExistente(
  grupoId: string,
  mockStore?: MockStoreDeduplicacao
): Promise<{ grupo_id: string; quantidade_reportes: number }> {
  if (mockStore) {
    const grp = mockStore.gruposExistentes.find((g) => g.id === grupoId)
    if (grp) {
      grp.quantidade_reportes += 1
      return { grupo_id: grp.id, quantidade_reportes: grp.quantidade_reportes }
    }
  }

  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )
      const fetchPromise = supabase
        .from('grupos_ocorrencia')
        .select('quantidade_reportes')
        .eq('id', grupoId)
        .single()

      const resFetch = await Promise.race([fetchPromise, timeoutPromise])
      if ('data' in resFetch && resFetch.data) {
        const novaQtd = (resFetch.data.quantidade_reportes || 1) + 1
        const updatePromise = supabase
          .from('grupos_ocorrencia')
          .update({
            quantidade_reportes: novaQtd,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', grupoId)
          .select()
          .single()

        const resUpdate = await Promise.race([updatePromise, timeoutPromise])
        if ('data' in resUpdate && resUpdate.data) {
          serverStore.recordSupabaseSuccess()
          return { grupo_id: resUpdate.data.id, quantidade_reportes: resUpdate.data.quantidade_reportes }
        }
      }
    } catch {
      serverStore.recordSupabaseFailure()
    }
  }

  return { grupo_id: grupoId, quantidade_reportes: 2 }
}
