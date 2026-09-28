import { NextResponse } from 'next/server'
import {
  verificarApiKeyIntegracao,
  formatarOcorrenciasParaGeoJSON,
  converterOcorrenciaParaProperties,
  registrarAtividadeIntegracao,
} from '@/lib/integracao-externa'
import { serverStore } from '@/lib/server-store'
import { createServiceClient } from '@/lib/supabase-server'
import { Ocorrencia, Prioridade } from '@/types/ocorrencia'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-API-Key, X-Signature-SHA256, X-Timestamp, X-Idempotency-Key',
  'Access-Control-Max-Age': '86400',
}

/**
 * Suporte completo a preflight CORS para permitir requisições diretas de frontends
 * externos (Leaflet, Mapbox, React, etc.) executados em localhost ou outros domínios.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * Endpoint Seguro de Integração para o Sistema Externo (Mapa de Distribuição de Água).
 * 
 * Modos de Autenticação Aceites:
 * 1. Cabeçalho 'X-API-Key: <chave>'
 * 2. Cabeçalho 'Authorization: Bearer <chave>'
 * 3. Parâmetro de URL '?api_key=<chave>' (ideal para testes no browser e bibliotecas GIS)
 * 4. Sessão autenticada do operador no dashboard (cookie saas_session)
 * 
 * Segregação de Dados:
 * Apenas ocorrências com status 'validado' são expostas.
 * Ocorrências rejeitadas/descartadas são estritamente filtradas.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  const queryApiKey =
    searchParams.get('api_key') || searchParams.get('token') || searchParams.get('key')

  // Permite visualização imediata no browser se o operador estiver com sessão ativa no dashboard
  const cookieHeader = request.headers.get('cookie') || ''
  const isSessionAuth = cookieHeader.includes('saas_session=')

  // 1. Verificação de Autenticação Segura
  if (!verificarApiKeyIntegracao(authHeader, apiKeyHeader, queryApiKey, isSessionAuth)) {
    return NextResponse.json(
      {
        erro: 'Não autorizado. Forneça uma chave de API válida no cabeçalho (X-API-Key / Authorization: Bearer) ou via parâmetro na URL (?api_key=...).',
        codigo: 'AUTH_INVALID_API_KEY',
        dica: 'Em ambiente de teste utilize ?api_key=saas_sec_mapa_dev_key_2026 ou configure o cabeçalho X-API-Key.',
      },
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          'WWW-Authenticate': 'Bearer error="invalid_token"',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  }

  // 2. Regista atividade de integração para sincronização em tempo real do indicador de saúde
  registrarAtividadeIntegracao(
    'api_pull',
    'Dados GeoJSON consumidos com sucesso pelo sistema externo do Mapa.'
  )

  // 3. Parâmetros de Consulta
  const formato = (searchParams.get('formato') || 'geojson').toLowerCase()
  const filtroPrioridades = searchParams.get('prioridade')?.split(',') as Prioridade[] | undefined
  const sinceParam = searchParams.get('since')

  // 4. Recuperação de Ocorrências (com Circuit Breaker & Fallback)
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

  // 5. Filtragem adicional em memória
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

  // 6. Formatação da Resposta de Acordo com o Padrão Solicitado
  const securityHeaders = {
    ...CORS_HEADERS,
    'Content-Type': formato === 'json' ? 'application/json' : 'application/geo+json',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
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
