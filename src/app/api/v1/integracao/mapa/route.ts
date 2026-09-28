import { NextResponse } from 'next/server'
import {
  verificarApiKeyIntegracao,
  formatarOcorrenciasParaGeoJSON,
  converterOcorrenciaParaProperties,
} from '@/lib/integracao-externa'
import { serverStore } from '@/lib/server-store'
import { createServiceClient } from '@/lib/supabase-server'
import { Ocorrencia, Prioridade } from '@/types/ocorrencia'

/**
 * Endpoint Seguro de Integração para o Sistema Externo (Mapa de Distribuição de Água).
 * 
 * Padrões de Segurança Aplicados:
 * 1. Autenticação via Chave de Serviço: 'X-API-Key' ou 'Authorization: Bearer <token>'
 * 2. Comparação em tempo constante (timing-safe) contra ataques de canal lateral.
 * 3. Segregação estrita de dados: apenas ocorrências com status 'validado' são expostas.
 *    Qualquer ocorrência descartada pelo operador é rigorosamente filtrada.
 * 4. Padrão RFC 7946 GeoJSON (FeatureCollection) pronto para consumo em GIS/Mapas.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  // 1. Verificação de Autenticação Segura
  if (!verificarApiKeyIntegracao(authHeader, apiKeyHeader)) {
    return NextResponse.json(
      {
        erro: 'Não autorizado. Forneça uma chave de API válida no cabeçalho X-API-Key ou Authorization: Bearer.',
        codigo: 'AUTH_INVALID_API_KEY',
      },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer error="invalid_token"',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  }

  // 2. Parâmetros de Consulta
  const { searchParams } = new URL(request.url)
  const formato = (searchParams.get('formato') || 'geojson').toLowerCase()
  const filtroPrioridades = searchParams.get('prioridade')?.split(',') as Prioridade[] | undefined
  const sinceParam = searchParams.get('since')

  // 3. Recuperação de Ocorrências (com Circuit Breaker & Fallback)
  let ocorrencias: Ocorrencia[] = []

  if (serverStore.canAttemptSupabase()) {
    try {
      const supabase = createServiceClient()
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase')), 1500)
      )

      let query = supabase
        .from('ocorrencias')
        .select('*')
        .eq('status', 'validado')

      if (sinceParam) {
        query = query.gte('atualizado_em', sinceParam)
      }

      const res = await Promise.race([query, timeoutPromise])
      if ('data' in res && res.data) {
        serverStore.recordSupabaseSuccess()
        ocorrencias = res.data as Ocorrencia[]
      }
    } catch {
      serverStore.recordSupabaseFailure()
    }
  }

  // Se o Supabase falhou ou não retornou dados, usa o ServerStore resiliente
  if (ocorrencias.length === 0) {
    ocorrencias = serverStore
      .listarOcorrencias()
      .filter((oc) => oc.status === 'validado')
  }

  // 4. Filtragem adicional em memória
  if (filtroPrioridades && filtroPrioridades.length > 0) {
    const setPrio = new Set(filtroPrioridades)
    ocorrencias = ocorrencias.filter((oc) => oc.prioridade && setPrio.has(oc.prioridade))
  }

  if (sinceParam) {
    const sinceTime = new Date(sinceParam).getTime()
    if (!isNaN(sinceTime)) {
      ocorrencias = ocorrencias.filter(
        (oc) => new Date(oc.atualizado_em || oc.criado_em).getTime() >= sinceTime
      )
    }
  }

  // 5. Formatação da Resposta de Acordo com o Padrão Solicitado
  const securityHeaders = {
    'Content-Type': formato === 'json' ? 'application/json' : 'application/geo+json',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  }

  if (formato === 'json') {
    const records = ocorrencias.map((oc) => ({
      ...converterOcorrenciaParaProperties(oc),
      coordenadas: {
        latitude: oc.latitude,
        longitude: oc.longitude,
      },
    }))

    return NextResponse.json(
      {
        total: records.length,
        gerado_em: new Date().toISOString(),
        ocorrencias: records,
      },
      { headers: securityHeaders }
    )
  }

  // Padrão GeoJSON RFC 7946
  const geojson = formatarOcorrenciasParaGeoJSON(ocorrencias)
  return new NextResponse(JSON.stringify(geojson, null, 2), {
    status: 200,
    headers: securityHeaders,
  })
}
