import { createServiceClient } from '@/lib/supabase-server'
import { serverStore } from '@/lib/server-store'
import {
  ContextoRede,
  ClassificacaoGemini,
  PriorityInput,
  FontesDadosMap,
  LocalFuga,
  IntensidadeReportada,
  AfetaOutros,
} from '@/types/ocorrencia'
import { mapearParaPriorityInput } from '@/lib/gemini-classifier'

/**
 * Constante configurável do raio de tolerância em metros para busca de ativos de rede GIS.
 */
export const RAIO_BUSCA_GIS_METROS = 30

/**
 * Calcula a distância Haversine em metros entre dois pontos geográficos.
 */
export function calcularDistanciaHaversineMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Raio da Terra em metros
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

interface ContextoFormulario {
  local_fuga?: LocalFuga | string | null
  intensidade_reportada?: IntensidadeReportada | string | null
  afeta_outros?: AfetaOutros | string | null
}

/**
 * Busca o ativo de rede cadastrado mais próximo das coordenadas fornecidas dentro do raio configurável.
 * 
 * @param latitude Latitude da ocorrência
 * @param longitude Longitude da ocorrência
 * @param listaAtivosOpcional Parâmetro opcional para injeção de dependência/testes isolados sem I/O
 */
export async function resolverContextoRede(
  latitude: number | null,
  longitude: number | null,
  listaAtivosOpcional?: ContextoRede[]
): Promise<ContextoRede | null> {
  if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
    return null
  }

  let ativos: ContextoRede[] = []

  if (listaAtivosOpcional) {
    ativos = listaAtivosOpcional
  } else {
    if (serverStore.canAttemptSupabase()) {
      try {
        const supabase = createServiceClient()
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
        )
        const fetchPromise = supabase.from('rede_cadastro').select('*')
        const res = await Promise.race([fetchPromise, timeoutPromise])
        if ('data' in res && res.data && res.data.length > 0) {
          ativos = res.data as unknown as ContextoRede[]
          serverStore.recordSupabaseSuccess()
        }
      } catch {
        serverStore.recordSupabaseFailure()
      }
    }

    if (ativos.length === 0) {
      ativos = serverStore.listarAtivosRede()
    }
  }

  let ativoMaisProximo: ContextoRede | null = null
  let menorDistancia = Infinity

  for (const ativo of ativos) {
    const dist = calcularDistanciaHaversineMetros(
      latitude,
      longitude,
      Number(ativo.latitude),
      Number(ativo.longitude)
    )

    if (dist <= RAIO_BUSCA_GIS_METROS && dist < menorDistancia) {
      menorDistancia = dist
      ativoMaisProximo = {
        ...ativo,
        distancia_metros: Math.round(dist * 10) / 10,
      }
    }
  }

  return ativoMaisProximo
}

/**
 * Aplica a regra de precedência (GIS > Gemini) para construir o PriorityInput e registrar as fontes de dados.
 */
export function montarPriorityInputComPrecedencia(
  classificacao: ClassificacaoGemini,
  contextoFormulario?: ContextoFormulario,
  contextoRede?: ContextoRede | null
): { priorityInput: PriorityInput; fontesDados: FontesDadosMap } {
  // 1. Obtém o mapeamento padrão derivado do Gemini / Formulário
  const baseGeminiInput = mapearParaPriorityInput(classificacao, contextoFormulario)

  const fontesDados: FontesDadosMap = {
    infraestrutura: 'gemini',
    diametro: 'gemini',
    caudal: 'gemini',
    impacto: 'gemini',
    risco: 'gemini',
  }

  let infraestrutura = baseGeminiInput.infraestrutura
  let diametro = baseGeminiInput.diametro

  // 2. Aplica precedência do GIS se o contexto da rede estiver disponível
  if (contextoRede) {
    // Mapeamento de infraestrutura real da rede GIS (1-5)
    fontesDados.infraestrutura = 'gis'
    switch (contextoRede.tipo_infraestrutura) {
      case 'principal':
      case 'reservatorio':
        infraestrutura = 5
        break
      case 'secundaria':
        infraestrutura = 3
        break
      case 'residencial':
      case 'outro':
      default:
        infraestrutura = 1
        break
    }

    // Mapeamento de diâmetro real da rede GIS (1-5)
    fontesDados.diametro = 'gis'
    const d = contextoRede.diametro_mm
    if (d > 200) diametro = 5
    else if (d > 100) diametro = 4
    else if (d > 50) diametro = 3
    else if (d >= 25) diametro = 2
    else diametro = 1
  }

  const priorityInput: PriorityInput = {
    ...baseGeminiInput,
    infraestrutura,
    diametro,
  }

  return { priorityInput, fontesDados }
}
