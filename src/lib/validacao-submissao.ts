import { createServiceClient } from '@/lib/supabase-server'
import { Ocorrencia } from '@/types/ocorrencia'
import { calcularDistanciaHaversineMetros } from '@/lib/gis-resolver'

export const MAX_SUBMISSOES_POR_JANELA = 5
export const JANELA_RATE_LIMIT_MINUTOS = 60

export const RAIO_DUPLICIDADE_MESMO_UTILIZADOR_METROS = 20
export const JANELA_DUPLICIDADE_MINUTOS = 10

export const TAMANHO_MAXIMO_IMAGEM_BYTES = 10 * 1024 * 1024 // 10MB
export const TAMANHO_MINIMO_IMAGEM_BYTES = 100 // 100 bytes

export const FORMATOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface ResultadoValidacaoImagem {
  valido: boolean
  erro?: string
}

/**
 * Valida os parâmetros técnicos da imagem enviada pelo cliente.
 */
export function validarImagemSubmissao(
  mimeType: string,
  tamanhoBytes: number
): ResultadoValidacaoImagem {
  if (!mimeType || !FORMATOS_PERMITIDOS.includes(mimeType.toLowerCase())) {
    return {
      valido: false,
      erro: 'Formato de imagem inválido. Apenas JPG, PNG e WebP são permitidos.',
    }
  }

  if (tamanhoBytes < TAMANHO_MINIMO_IMAGEM_BYTES) {
    return {
      valido: false,
      erro: 'Imagem corrompida ou demasiado pequena (mínimo 100 bytes).',
    }
  }

  if (tamanhoBytes > TAMANHO_MAXIMO_IMAGEM_BYTES) {
    return {
      valido: false,
      erro: 'Imagem excede o limite máximo permitido de 10MB.',
    }
  }

  return { valido: true }
}

/**
 * Verifica o rate limit por contacto (máximo N submissões em M minutos).
 */
export async function verificarRateLimitContacto(
  contacto: string,
  historicoSubmissoesMock?: { contacto: string; criado_em: string }[]
): Promise<boolean> {
  if (!contacto || !contacto.trim()) return true

  const contactoNorm = contacto.trim().toLowerCase()
  const agora = new Date()
  const dataLimite = new Date(agora.getTime() - JANELA_RATE_LIMIT_MINUTOS * 60 * 1000)

  if (historicoSubmissoesMock) {
    const recentes = historicoSubmissoesMock.filter((s) => {
      if (s.contacto.trim().toLowerCase() !== contactoNorm) return false
      return new Date(s.criado_em) >= dataLimite
    })
    return recentes.length < MAX_SUBMISSOES_POR_JANELA
  }

  try {
    const supabase = createServiceClient()
    const { count, error } = await supabase
      .from('ocorrencias')
      .select('id', { count: 'exact', head: true })
      .eq('contacto_cliente', contactoNorm)
      .gte('criado_em', dataLimite.toISOString())

    if (error) {
      console.error('Erro ao verificar rate limit:', error.message)
      return true
    }

    return (count || 0) < MAX_SUBMISSOES_POR_JANELA
  } catch (err) {
    console.error('Falha na verificação de rate limit:', err)
    return true
  }
}

/**
 * Verifica se o mesmo contacto já enviou um reporte nas mesmas coordenadas (<20m) nos últimos 10 minutos.
 */
export async function detectarDuplicidadeMesmoContacto(
  contacto: string,
  latitude: number | null,
  longitude: number | null,
  ocorrenciasMock?: Ocorrencia[]
): Promise<{ isDuplicate: boolean; existingOccurrenceId?: string }> {
  if (!contacto || latitude === null || longitude === null) {
    return { isDuplicate: false }
  }

  const contactoNorm = contacto.trim().toLowerCase()
  const agora = new Date()
  const dataLimite = new Date(agora.getTime() - JANELA_DUPLICIDADE_MINUTOS * 60 * 1000)

  let candidatos: Ocorrencia[] = []

  if (ocorrenciasMock) {
    candidatos = ocorrenciasMock.filter((o) => {
      if (!o.contacto_cliente || o.contacto_cliente.trim().toLowerCase() !== contactoNorm) return false
      return new Date(o.criado_em) >= dataLimite
    })
  } else {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('ocorrencias')
        .select('*')
        .eq('contacto_cliente', contactoNorm)
        .gte('criado_em', dataLimite.toISOString())

      if (error || !data) return { isDuplicate: false }
      candidatos = data as Ocorrencia[]
    } catch {
      return { isDuplicate: false }
    }
  }

  for (const cand of candidatos) {
    if (cand.latitude === null || cand.longitude === null) continue
    const dist = calcularDistanciaHaversineMetros(
      latitude,
      longitude,
      Number(cand.latitude),
      Number(cand.longitude)
    )

    if (dist <= RAIO_DUPLICIDADE_MESMO_UTILIZADOR_METROS) {
      return { isDuplicate: true, existingOccurrenceId: cand.id }
    }
  }

  return { isDuplicate: false }
}
