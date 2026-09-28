'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Ocorrencia, Prioridade, Notificacao } from '@/types/ocorrencia'
import { PRIORITY_TOKENS, STATUS_TOKENS } from '@/lib/design-tokens'
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  RefreshCw,
  UserCheck,
  Check,
  Flame,
  Activity,
  FileText,
  Users,
  Database,
  Send,
  Zap,
  Bell,
  X,
  XCircle,
  BarChart3,
  Search,
  Maximize2,
  ExternalLink,
  Camera,
  MapPin,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Filtros
  const [filterPrioridade, setFilterPrioridade] = useState<string>('TODAS')
  const [filterStatus, setFilterStatus] = useState<string>('TODOS')
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('busca') || ''
    }
    return ''
  })

  // Modais e Estados de Ação
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [operadorNome, setOperadorNome] = useState('')
  const [prioridadeConfirmadaMap, setPrioridadeConfirmadaMap] = useState<Record<string, Prioridade>>({})
  const [motivoDescarteMap, setMotivoDescarteMap] = useState<Record<string, string>>({})
  const [creatingTest, setCreatingTest] = useState(false)
  const [escalatingSLA, setEscalatingSLA] = useState(false)
  const [isResilientMode, setIsResilientMode] = useState(false)

  // Modais de Visualização Expandida
  const [modalFotoUrl, setModalFotoUrl] = useState<string | null>(null)
  const [detalhesOcorrencia, setDetalhesOcorrencia] = useState<Ocorrencia | null>(null)

  // Carrega ocorrências da API com resiliência
  const fetchOcorrencias = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/ocorrencias')
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Falha ao buscar ocorrências')

      if (json.isFallback) {
        setIsResilientMode(true)
      } else {
        setIsResilientMode(false)
      }

      const list = (json.data || []) as Ocorrencia[]
      const sorted = list.sort((a, b) => {
        const orderA = a.prioridade ? parseInt(a.prioridade.replace('P', '')) : 99
        const orderB = b.prioridade ? parseInt(b.prioridade.replace('P', '')) : 99

        if (orderA !== orderB) {
          return orderA - orderB
        }
        return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      })

      setOcorrencias(sorted)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao buscar ocorrências:', msg)
      setErrorMsg(`Erro ao carregar dados: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega notificações (as mais recentes)
  const fetchNotificacoes = useCallback(async () => {
    try {
      const res = await fetch('/api/notificacoes')
      const json = await res.json()
      if (res.ok && json.data) {
        setNotificacoes(json.data as Notificacao[])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao buscar notificações:', msg)
    }
  }, [])

  // Carregamento inicial e assinatura Realtime
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOcorrencias()
      fetchNotificacoes()
    }, 0)

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel('realtime_notificacoes_dashboard')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificacoes' },
          (payload) => {
            const novaNotif = payload.new as Notificacao
            setNotificacoes((prev) => [novaNotif, ...prev])
          }
        )
        .subscribe()
    } catch {
      // Ignora falha de socket se Supabase estiver offline
    }

    return () => {
      clearTimeout(timer)
      if (channel) {
        try {
          const supabase = createClient()
          supabase.removeChannel(channel)
        } catch {
          // Ignora
        }
      }
    }
  }, [fetchOcorrencias, fetchNotificacoes])

  // Marca notificação como lida mantendo-a na lista (não some)
  const handleMarcarLida = async (notifId: string) => {
    try {
      await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notifId, lida: true }),
      })
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n))
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao marcar notificação como lida:', msg)
    }
  }

  // Executa escalonamento de SLA sob demanda
  const handleExecutarEscalonamento = async () => {
    setEscalatingSLA(true)
    setErrorMsg(null)
    setSuccessBanner(null)
    try {
      const res = await fetch('/api/cron/escalonar', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao executar escalonamento')

      setSuccessBanner(json.mensagem || 'Ciclo de SLA concluído com sucesso.')
      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Erro no escalonamento SLA: ${msg}`)
    } finally {
      setEscalatingSLA(false)
    }
  }

  // Dispara a triagem via API Route /api/classificar
  const handleClassificar = async (id: string, forcar = false) => {
    setProcessingId(id)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/classificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocorrencia_id: id, forcar_reanalise: forcar }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Falha ao processar ocorrência na API')
      }

      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao classificar:', msg)
      setErrorMsg(`Falha na triagem: ${msg}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Confirma validação pelo operador e despacha para o Mapa de Distribuição
  const handleConfirmarValidacao = async (ocorrencia: Ocorrencia) => {
    if (!operadorNome.trim()) {
      alert('Por favor introduza o nome ou identificação do operador.')
      return
    }

    setProcessingId(ocorrencia.id)
    const prioConfirmada = prioridadeConfirmadaMap[ocorrencia.id] || ocorrencia.prioridade || 'P3'

    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ocorrencia.id,
          prioridade: prioConfirmada,
          status: 'validado',
          validado_por: operadorNome.trim(),
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao validar ocorrência')
      }

      setValidatingId(null)
      setOperadorNome('')
      setSuccessBanner(
        `Ocorrência ${ocorrencia.id.substring(0, 8).toUpperCase()} aprovada como ${prioConfirmada} e despachada para o Mapa de Distribuição!`
      )
      setTimeout(() => setSuccessBanner(null), 5000)
      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao validar:', msg)
      setErrorMsg(`Erro ao validar ocorrência: ${msg}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Descarta a ocorrência pelo operador (fora de âmbito / fora da rede de distribuição)
  const handleDescartarOcorrencia = async (ocorrencia: Ocorrencia) => {
    if (!operadorNome.trim()) {
      alert('Por favor introduza o nome ou identificação do operador.')
      return
    }

    const motivo =
      motivoDescarteMap[ocorrencia.id] ||
      'Fora da área de concessão / Fora da rede de distribuição sob gestão'

    setProcessingId(ocorrencia.id)
    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ocorrencia.id,
          status: 'rejeitado',
          validado_por: operadorNome.trim(),
          motivo_descarte: motivo,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao descartar ocorrência')
      }

      setValidatingId(null)
      setOperadorNome('')
      setSuccessBanner(
        `Ocorrência ${ocorrencia.id.substring(0, 8).toUpperCase()} descartada pelo operador. Não será enviada ao Mapa de Distribuição.`
      )
      setTimeout(() => setSuccessBanner(null), 5000)
      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao descartar:', msg)
      setErrorMsg(`Erro ao descartar ocorrência: ${msg}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Conclui e encerra uma ocorrência resolvida
  const handleConcluirOcorrencia = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'resolvido',
          validado_por: operadorNome.trim() || 'Operador Central',
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao concluir ocorrência')
      }
      setSuccessBanner('Ocorrência marcada como resolvida com sucesso.')
      setTimeout(() => setSuccessBanner(null), 4000)
      await fetchOcorrencias()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Erro ao concluir ocorrência: ${msg}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Remove definitivamente uma ocorrência da fila
  const handleRemoverOcorrencia = async (id: string) => {
    if (!confirm(`Deseja realmente remover a ocorrência ${id.substring(0, 8)} da fila de triagem?`)) {
      return
    }
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ocorrencias?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao remover ocorrência')
      }
      setSuccessBanner('Ocorrência removida com sucesso.')
      setTimeout(() => setSuccessBanner(null), 4000)
      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Erro ao remover ocorrência: ${msg}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Limpa todas as ocorrências da fila operacional
  const handleLimparFila = async () => {
    if (!confirm('Atenção: Deseja realmente remover todas as ocorrências da fila de triagem? Esta ação não pode ser desfeita.')) {
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ocorrencias?all=true', {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Falha ao limpar fila')
      }
      setSuccessBanner('Fila de triagem limpa com sucesso.')
      setTimeout(() => setSuccessBanner(null), 4000)
      await fetchOcorrencias()
      await fetchNotificacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Erro ao limpar fila: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // Cria ocorrência de teste para ensaios visuais
  const handleCriarOcorrenciaTeste = async (tipo: 'critica' | 'media' | 'baixa' | 'sem_fuga') => {
    setCreatingTest(true)
    setErrorMsg(null)
    try {
      let payload: Record<string, unknown> = {}

      if (tipo === 'critica') {
        payload = {
          foto_url: 'https://images.unsplash.com/photo-1542013936693-884638332954?w=600&auto=format&fit=crop&q=80',
          local_fuga: 'conduta',
          agua_saindo_agora: true,
          intensidade_reportada: 'jacto',
          afeta_outros: 'rua_zona',
          latitude: -25.9692,
          longitude: 32.5732,
          contacto_cliente: '+258 84 123 4567',
          observacoes_cliente: 'Cisalhamento de conduta adutora de grande diâmetro na Av. 25 de Setembro, Baixa de Maputo, com jacto de água violento.',
          tipo_pavimento: 'asfalto',
          risco_acidente: true,
        }
      } else if (tipo === 'media') {
        payload = {
          foto_url: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80',
          local_fuga: 'passeio',
          agua_saindo_agora: true,
          intensidade_reportada: 'fluxo_forte',
          afeta_outros: 'uma_residencia',
          latitude: -25.9622,
          longitude: 32.4589,
          contacto_cliente: 'contacto@matola.co.mz',
          observacoes_cliente: 'Fuga contínua no passeio/valeta da Av. da União Africana, Matola, afetando circulação pedonal.',
          tipo_pavimento: 'calcada',
          risco_acidente: false,
        }
      } else if (tipo === 'baixa') {
        payload = {
          foto_url: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600&auto=format&fit=crop&q=80',
          local_fuga: 'dentro_residencia',
          agua_saindo_agora: false,
          intensidade_reportada: 'gotas',
          afeta_outros: 'nao',
          latitude: -25.9535,
          longitude: 32.5880,
          contacto_cliente: 'morador@polana.co.mz',
          observacoes_cliente: 'Gotejamento lento no contador de água residencial no bairro da Polana / Sommerschield.',
          tipo_pavimento: 'outro',
          risco_acidente: false,
        }
      } else {
        payload = {
          foto_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
          local_fuga: 'dentro_residencia',
          agua_saindo_agora: false,
          intensidade_reportada: 'gotas',
          afeta_outros: 'nao',
          latitude: -25.9653,
          longitude: 32.5892,
          contacto_cliente: 'teste_rejeicao@saas.co.mz',
          observacoes_cliente: 'Imagem de sala/ambiente seco sem qualquer indício de água para teste do filtro de rejeição IA (Moçambique).',
          tipo_pavimento: 'outro',
          risco_acidente: false,
        }
      }

      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao criar ocorrência de teste via API')
      }

      if (json.ocorrencia?.id) {
        await handleClassificar(json.ocorrencia.id)
      } else {
        await fetchOcorrencias()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro ao criar teste:', msg)
      setErrorMsg(`Erro ao criar ocorrência de teste: ${msg}`)
    } finally {
      setCreatingTest(false)
    }
  }

  // Filtragem local
  const ocorrenciasFiltradas = ocorrencias.filter((item) => {
    if (filterPrioridade !== 'TODAS' && item.prioridade !== filterPrioridade) {
      return false
    }
    if (filterStatus !== 'TODOS' && item.status !== filterStatus) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchId = item.id.toLowerCase().includes(q)
      const matchLocal = (item.local_fuga || '').toLowerCase().includes(q)
      const matchEquipa = (item.equipa_atribuida || '').toLowerCase().includes(q)
      const matchContacto = (item.contacto_cliente || '').toLowerCase().includes(q)
      if (!matchId && !matchLocal && !matchEquipa && !matchContacto) return false
    }
    return true
  })

  // Particionamento: Ocorrências Ativas na frente e Ocorrências Atendidas/Concluídas no fim
  const ocorrenciasAtivas = ocorrenciasFiltradas.filter(
    (item) => item.status !== 'resolvido' && item.status !== 'rejeitado'
  )
  const ocorrenciasAtendidas = ocorrenciasFiltradas.filter(
    (item) => item.status === 'resolvido' || item.status === 'rejeitado'
  )

  const naoLidasCount = notificacoes.filter((n) => !n.lida).length
  const totalCriticasP1 = ocorrencias.filter((o) => o.prioridade === 'P1').length
  const totalValidadasNoMapa = ocorrencias.filter((o) => o.status === 'validado').length
  const totalDescartadas = ocorrencias.filter((o) => o.status === 'rejeitado').length

  // Renderiza badge de status do SLA (sem animação de piscar)
  const renderSLAStatus = (ocorrencia: Ocorrencia) => {
    if (!ocorrencia.sla_limite) return null

    const limite = new Date(ocorrencia.sla_limite)
    const agora = new Date()
    const diffMs = limite.getTime() - agora.getTime()
    const diffMin = Math.round(diffMs / 60000)

    if (diffMin < 0) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-700 text-white text-[11px] font-bold px-2 py-0.5 corporate-badge">
          <AlertTriangle className="w-3 h-3 text-red-200" />
          <span>SLA EXPIRADO {ocorrencia.escalonada ? `(ESC ${ocorrencia.prioridade_original})` : ''}</span>
        </span>
      )
    }

    const horas = Math.floor(diffMin / 60)
    const min = diffMin % 60
    return (
      <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-100 text-[11px] font-mono px-2 py-0.5 corporate-badge">
        <Clock className="w-3 h-3 text-blue-400" />
        <span>SLA: {horas > 0 ? `${horas}h ${min}m` : `${min}m`}</span>
      </span>
    )
  }

  // Renderizador de Card individual
  const renderCard = (ocorrencia: Ocorrencia, isHistorico: boolean) => {
    const isProcessing = processingId === ocorrencia.id
    const isValidating = validatingId === ocorrencia.id
    const gemini = ocorrencia.classificacao_gemini
    const fontes = ocorrencia.fontes_dados
    const grupo = ocorrencia.grupo
    const despacho = ocorrencia.decisao_despacho
    const prioToken = ocorrencia.prioridade ? PRIORITY_TOKENS[ocorrencia.prioridade] : null
    const statusToken = STATUS_TOKENS[ocorrencia.status]

    return (
      <div
        key={ocorrencia.id}
        className={`bg-zinc-900 border ${
          ocorrencia.status === 'rejeitado'
            ? 'border-rose-900/80'
            : isHistorico
            ? 'border-zinc-800'
            : prioToken
            ? prioToken.borderClass
            : 'border-zinc-800'
        } border-l-4 corporate-card p-3.5 sm:p-4 shadow-xs`}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* THUMBNAIL DA FOTO COM CLIQUE PARA EXPANDIR OU AVISO DE RETENÇÃO 48H */}
          {ocorrencia.foto_expirada || ocorrencia.foto_url === 'retencao_expirada_48h' ? (
            <div className="shrink-0 w-full sm:w-44 h-36 bg-zinc-950 border border-zinc-800 corporate-card flex flex-col items-center justify-center p-2 text-center text-zinc-500">
              <Clock className="w-5 h-5 text-zinc-600 mb-1" />
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400">Foto Expurgada</span>
              <span className="text-[9px] text-zinc-600 font-mono">Retenção 48h</span>
              <div className="mt-2 bg-black/85 text-zinc-400 text-[10px] font-mono px-1.5 py-0.5 corporate-card">
                {ocorrencia.id.substring(0, 8).toUpperCase()}
              </div>
            </div>
          ) : (
            <div
              onClick={() => setModalFotoUrl(ocorrencia.foto_url)}
              className="shrink-0 w-full sm:w-44 h-36 bg-zinc-950 border border-zinc-700 corporate-card overflow-hidden relative group cursor-pointer"
              title="Clique para visualizar fotografia em alta resolução"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ocorrencia.foto_url}
                alt={`Ocorrência ${ocorrencia.id}`}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542013936693-884638332954?w=600&auto=format&fit=crop&q=80'
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                <Maximize2 className="w-4 h-4" />
                <span>Ampliar</span>
              </div>
              <div className="absolute bottom-1.5 left-1.5 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.5 corporate-card">
                {ocorrencia.id.substring(0, 8).toUpperCase()}
              </div>
            </div>
          )}

          {/* DADOS DA OCORRÊNCIA */}
          <div className="flex-1 space-y-2.5 min-w-0">
            {/* BARRA SUPERIOR DO CARD (ETIQUETAS CONCISAS) */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                {ocorrencia.status === 'rejeitado' ? (
                  <span className="bg-rose-900 text-rose-100 border border-rose-700 font-bold corporate-badge px-2 py-0.5 text-xs flex items-center gap-1 font-mono">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>SEM FUGA (REJEITADO)</span>
                  </span>
                ) : prioToken ? (
                  <span className={`${prioToken.bgClass} font-bold corporate-badge px-2 py-0.5 text-xs flex items-center gap-1 font-mono`}>
                    <prioToken.icon className="w-3.5 h-3.5" />
                    <span>{prioToken.label}</span>
                  </span>
                ) : (
                  <span className="bg-zinc-800 text-zinc-300 font-bold corporate-badge px-2 py-0.5 text-xs font-mono">
                    NÃO TRIADO
                  </span>
                )}

                {grupo && grupo.quantidade_reportes > 1 && (
                  <span className="bg-purple-900 text-purple-100 border border-purple-700 text-xs font-bold corporate-badge px-2 py-0.5 flex items-center gap-1 font-mono">
                    <Users className="w-3.5 h-3.5" />
                    <span>{grupo.quantidade_reportes} REPORTES</span>
                  </span>
                )}

                {ocorrencia.priority_score !== null && (
                  <span className="bg-zinc-800 text-zinc-200 text-xs font-mono font-bold corporate-badge px-2 py-0.5 border border-zinc-700">
                    SCORE: {ocorrencia.priority_score}/100
                  </span>
                )}

                {renderSLAStatus(ocorrencia)}
              </div>

              <span className={`text-[11px] font-bold uppercase tracking-wider corporate-badge px-2 py-0.5 flex items-center gap-1 ${statusToken.badgeClass}`}>
                <statusToken.icon className="w-3 h-3" />
                <span>{statusToken.label}</span>
              </span>
            </div>

            {/* BANNER SE REJEITADO */}
            {ocorrencia.status === 'rejeitado' && (
              <div className="bg-rose-950/40 border border-rose-900 p-2 corporate-card text-xs text-rose-200">
                <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-300 font-mono uppercase tracking-wide">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Descarte por IA (Sem Evidência de Fuga)</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {ocorrencia.motivo_rejeicao ||
                    ocorrencia.classificacao_gemini?.reason ||
                    'A análise computacional não detectou água corrente na via pública.'}
                </p>
              </div>
            )}

            {/* FONTES DE DADOS E INFRAESTRUTURA */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] bg-zinc-800/60 p-2 corporate-card border border-zinc-800 text-zinc-300">
              <span className="font-bold flex items-center gap-1 text-blue-400 font-mono">
                <Database className="w-3 h-3" />
                PRECEDÊNCIA:
              </span>
              {fontes ? (
                <>
                  <span>
                    Infra:{' '}
                    <strong className={fontes.infraestrutura === 'gis' ? 'text-emerald-400' : 'text-amber-400'}>
                      {fontes.infraestrutura.toUpperCase()}
                    </strong>
                  </span>
                  <span>
                    Diâmetro:{' '}
                    <strong className={fontes.diametro === 'gis' ? 'text-emerald-400' : 'text-amber-400'}>
                      {fontes.diametro.toUpperCase()}
                    </strong>
                  </span>
                  <span>
                    Caudal: <strong className="text-zinc-200">GEMINI ({gemini?.water_flow || 'observado'})</strong>
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">Aguardando processamento inicial...</span>
              )}
            </div>

            {/* ESTADO DE INTEGRAÇÃO COM O MAPA DE DISTRIBUIÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {despacho && (
                <div className="border border-zinc-800 p-2 corporate-card bg-zinc-800/40 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold text-zinc-400">DESPACHO IA: </span>
                    <span className="font-bold text-blue-300 font-mono">
                      {despacho.acao.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {ocorrencia.status === 'validado' ? (
                <div className="border border-emerald-800/80 p-2 corporate-card bg-emerald-950/30 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">INTEGRAÇÃO: </span>
                    <span className="font-bold text-emerald-400">Transmitido ao Mapa</span>
                  </div>
                </div>
              ) : ocorrencia.status === 'rejeitado' ? (
                <div className="border border-rose-800/80 p-2 corporate-card bg-rose-950/30 flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-300">ESTADO: </span>
                    <span className="font-bold text-rose-400">Descartado (Omitido do Mapa)</span>
                  </div>
                </div>
              ) : (
                <div className="border border-amber-800/80 p-2 corporate-card bg-amber-950/20 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300">ESTADO: </span>
                    <span className="font-bold text-amber-400">Aguardando Triagem</span>
                  </div>
                </div>
              )}
            </div>

            {/* BARRA DE AÇÕES DO OPERADOR (UNIFORME E ALINHADA) */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-800 text-xs">
              <div>
                {ocorrencia.validado_por ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Operador: {ocorrencia.validado_por}
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Aguardando validação do operador
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* BOTÃO DE DETALHES COMPLETOS DO CIDADÃO */}
                <button
                  onClick={() => setDetalhesOcorrencia(ocorrencia)}
                  className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 h-8 px-2.5 py-1 text-xs font-semibold flex items-center gap-1"
                  title="Ver formulário e dados fornecidos pelo cidadão"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Detalhes</span>
                </button>

                {/* BOTÃO TRIAR / RE-TRIAR */}
                <button
                  onClick={() => handleClassificar(ocorrencia.id, true)}
                  disabled={isProcessing}
                  className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 h-8 px-2.5 py-1 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                  title="Executar pipeline determinístico Gemini e GIS"
                >
                  <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{ocorrencia.prioridade ? 'Re-triar' : 'Triar'}</span>
                </button>

                {/* BOTÃO TRIAR / DECIDIR (SOMENTE SE NÃO VALIDADO NEM RESOLVIDO) */}
                {ocorrencia.status !== 'validado' && ocorrencia.status !== 'resolvido' && (
                  <button
                    onClick={() => {
                      setValidatingId(ocorrencia.id)
                    }}
                    disabled={isProcessing}
                    className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Triar Ocorrência</span>
                  </button>
                )}

                {/* BOTÃO CONCLUIR / RESOLVER */}
                {ocorrencia.status !== 'resolvido' && (
                  <button
                    onClick={() => handleConcluirOcorrencia(ocorrencia.id)}
                    disabled={isProcessing}
                    className="corporate-btn bg-emerald-700 hover:bg-emerald-800 text-white h-8 px-2.5 py-1 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    title="Marcar ocorrência como concluída e resolvida"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Concluir</span>
                  </button>
                )}

                {/* BOTÃO REMOVER / ELIMINAR */}
                <button
                  onClick={() => handleRemoverOcorrencia(ocorrencia.id)}
                  disabled={isProcessing}
                  className="corporate-btn bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-800 h-8 px-2 py-1 text-xs font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  title="Remover definitivamente esta ocorrência da fila"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Remover</span>
                </button>
              </div>
            </div>

            {/* PAINEL INLINE DE TRIAGEM: APROVAÇÃO PARA O MAPA OU DESCARTE */}
            {isValidating && (
              <div className="mt-3 p-3.5 bg-zinc-950 border border-blue-600 corporate-card space-y-3">
                <div className="text-xs font-bold text-blue-300 flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider font-mono">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    Decisão Operacional de Triagem — Aprovar para Mapa ou Descartar
                  </span>
                  <button
                    onClick={() => setValidatingId(null)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* OPÇÃO 1: APROVAR E TRANSMITIR AO MAPA */}
                  <div className="p-3 bg-zinc-900 border border-emerald-800/80 corporate-card space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>1. APROVAR & ENVIAR AO MAPA</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      A ocorrência está dentro da rede de distribuição. Transmite os dados criptografados para o sistema do mapa externo.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5 font-mono">
                          OPERADOR RESPONSÁVEL:
                        </label>
                        <input
                          type="text"
                          value={operadorNome}
                          onChange={(e) => setOperadorNome(e.target.value)}
                          placeholder="Nome do operador..."
                          className="corporate-input w-full bg-zinc-950 border border-zinc-700 text-xs p-1.5 text-zinc-100 font-medium"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5 font-mono">
                          PRIORIDADE CONFIRMADA:
                        </label>
                        <select
                          value={prioridadeConfirmadaMap[ocorrencia.id] || ocorrencia.prioridade || 'P3'}
                          onChange={(e) =>
                            setPrioridadeConfirmadaMap({
                              ...prioridadeConfirmadaMap,
                              [ocorrencia.id]: e.target.value as Prioridade,
                            })
                          }
                          className="corporate-input w-full bg-zinc-950 border border-zinc-700 text-xs p-1.5 text-zinc-100 font-bold font-mono"
                        >
                          <option value="P1">P1 — Crítica (Emergência)</option>
                          <option value="P2">P2 — Alta Prioridade</option>
                          <option value="P3">P3 — Média Prioridade</option>
                          <option value="P4">P4 — Baixa Prioridade</option>
                          <option value="P5">P5 — Mínima (Monitorização)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmarValidacao(ocorrencia)}
                      disabled={isProcessing}
                      className="corporate-btn w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-3 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aprovar & Transmitir ao Mapa (GIS)</span>
                    </button>
                  </div>

                  {/* OPÇÃO 2: DESCARTAR OCORRÊNCIA (FORA DE ÂMBITO) */}
                  <div className="p-3 bg-zinc-900 border border-rose-900/80 corporate-card space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 font-mono">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>2. DESCARTAR (FORA DE ÂMBITO)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      A ocorrência está fora da rede de concessão, em rede privada ou é falso positivo. Será omitida do mapa.
                    </p>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-0.5 font-mono">
                        MOTIVO DO DESCARTE:
                      </label>
                      <select
                        value={
                          motivoDescarteMap[ocorrencia.id] ||
                          'Fora da área de concessão / Fora da rede de distribuição sob gestão'
                        }
                        onChange={(e) =>
                          setMotivoDescarteMap({
                            ...motivoDescarteMap,
                            [ocorrencia.id]: e.target.value,
                          })
                        }
                        className="corporate-input w-full bg-zinc-950 border border-zinc-700 text-xs p-1.5 text-zinc-100 font-medium"
                      >
                        <option value="Fora da área de concessão / Fora da rede de distribuição sob gestão">
                          Fora da rede / Perímetro de distribuição
                        </option>
                        <option value="Rede predial interna privada (responsabilidade do utente)">
                          Rede predial interna privada (Utente)
                        </option>
                        <option value="Sem evidência de fuga / Imagem inconclusiva / Falso positivo">
                          Falso positivo / Sem fuga visível
                        </option>
                        <option value="Reporte duplicado ou intervenção já concluída na via">
                          Reporte duplicado / Já atendido
                        </option>
                        <option value="Outro motivo operacional devidamente registado">
                          Outro motivo operacional
                        </option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleDescartarOcorrencia(ocorrencia)}
                      disabled={isProcessing}
                      className="corporate-btn w-full bg-rose-800 hover:bg-rose-900 text-white text-xs font-bold py-2 px-3 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Descartar Ocorrência (Omitir do Mapa)</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => setValidatingId(null)}
                    className="corporate-btn bg-zinc-800 text-zinc-300 text-xs px-3 py-1 font-semibold"
                  >
                    Fechar Painel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1. TITLE STRIP / BARRA SUPERIOR DE AÇÕES */}
      <div className="bg-zinc-900 border border-zinc-800 corporate-card px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-zinc-100">
            SAAS — Consola de Triagem & Despacho Operacional
          </span>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <span className="font-mono text-zinc-400 hidden sm:inline">
            Fila Operacional Unificada
          </span>
          {isResilientMode && (
            <span
              className="bg-amber-950 text-amber-200 border border-amber-800 px-2 py-0.5 text-[10px] font-bold font-mono corporate-badge flex items-center gap-1.5"
              title="Store em memória ativo para operação ininterrupta de alta disponibilidade."
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              STORE EM MEMÓRIA ATIVO
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÃO ESCALONAMENTO SLA */}
          <button
            onClick={handleExecutarEscalonamento}
            disabled={escalatingSLA}
            className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 h-8 px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            title="Executar verificação e escalonamento automático de SLA agora"
          >
            <Clock className={`w-3.5 h-3.5 text-blue-400 ${escalatingSLA ? 'animate-spin' : ''}`} />
            <span>Escalonar SLA</span>
          </button>

          {/* LINK METRICAS */}
          <Link
            href="/dashboard/metricas"
            className="corporate-btn bg-purple-700 hover:bg-purple-800 text-white h-8 px-2.5 py-1 text-xs font-bold flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Métricas</span>
          </Link>

          {/* SINO DE NOTIFICAÇÕES REALTIME COM PERSISTÊNCIA */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="corporate-btn border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 h-8 px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 relative"
              title="Visualizar notificações recentes"
            >
              <Bell className="w-4 h-4 text-blue-400" />
              {naoLidasCount > 0 ? (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 corporate-badge">
                  {naoLidasCount}
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400 font-mono">
                  {notificacoes.length}
                </span>
              )}
            </button>

            {/* DROPDOWN DAS 5 NOTIFICAÇÕES MAIS RECENTES */}
            {showNotifPanel && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 corporate-card shadow-xl z-50 p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5 font-mono">
                    <Bell className="w-3.5 h-3.5 text-blue-400" />
                    Alertas em Tempo Real
                  </span>
                  <button
                    onClick={() => setShowNotifPanel(false)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[10px] text-zinc-400 font-mono">
                  Últimos 5 registos recebidos ({naoLidasCount} não lidos)
                </div>

                {notificacoes.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Nenhuma notificação registada.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 corporate-scrollbar">
                    {notificacoes.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 border text-xs corporate-card ${
                          n.lida
                            ? 'bg-zinc-850 border-zinc-800 opacity-75'
                            : 'bg-zinc-800 border-blue-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-zinc-100">{n.titulo}</span>
                          {!n.lida ? (
                            <button
                              onClick={() => handleMarcarLida(n.id)}
                              className="text-[10px] text-blue-400 hover:text-blue-300 underline font-bold"
                            >
                              Marcar lida
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-0.5">
                              <Check className="w-3 h-3 text-zinc-500" />
                              Lida
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-300 mt-1">{n.mensagem}</p>
                        <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
                          {new Date(n.criado_em).toLocaleTimeString('pt-MZ', { timeZone: 'Africa/Maputo' })} CAT
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* LINK DEDICADO PARA TODAS AS NOTIFICAÇÕES */}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <Link
                    href="/dashboard/notificacoes"
                    onClick={() => setShowNotifPanel(false)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5"
                  >
                    <span>Ver Todas as Notificações ({notificacoes.length})</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => setShowNotifPanel(false)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ATUALIZAR DADOS */}
          <button
            onClick={() => {
              fetchOcorrencias()
              fetchNotificacoes()
            }}
            disabled={loading}
            className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 p-1 sm:p-2 space-y-4 max-w-7xl mx-auto w-full">
        {/* BANNERS DE STATUS / FEEDBACK */}
        {successBanner && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-2.5 corporate-card flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {successBanner}
            </span>
            <button onClick={() => setSuccessBanner(null)} className="underline text-[11px]">
              Fechar
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-3 corporate-card flex items-start gap-2.5 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Aviso Operacional: </span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold underline">
              Fechar
            </button>
          </div>
        )}

        {/* 2. SUMÁRIO DE ESTADO (KPI STRIP) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-zinc-900 border border-zinc-800 p-2.5 corporate-card">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block font-mono">Total no Sistema</span>
            <span className="text-xl font-bold font-mono text-zinc-100">{ocorrencias.length}</span>
          </div>

          <div className="bg-zinc-900 border-l-4 border-l-red-600 border border-zinc-800 p-2.5 corporate-card">
            <span className="text-[10px] font-bold text-red-400 uppercase block font-mono">P1 — Críticas Ativas</span>
            <span className="text-xl font-bold font-mono text-red-400">{totalCriticasP1}</span>
          </div>

          <div className="bg-zinc-900 border-l-4 border-l-emerald-600 border border-zinc-800 p-2.5 corporate-card">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block font-mono">No Mapa (Validadas)</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{totalValidadasNoMapa}</span>
          </div>

          <div className="bg-zinc-900 border-l-4 border-l-rose-700 border border-zinc-800 p-2.5 corporate-card">
            <span className="text-[10px] font-bold text-rose-400 uppercase block font-mono">Descartadas (Fora)</span>
            <span className="text-xl font-bold font-mono text-rose-400">{totalDescartadas}</span>
          </div>
        </div>

        {/* 3. SIMULADOR DE SUBMISSÕES RÁPIDO */}
        <div className="win-groupbox">
          <legend>Simulador Operacional de Submissões (Ensaios Visuais)</legend>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-zinc-400 font-medium">
              Gera ocorrência com foto real, geolocalização e executa pipeline determinístico integral.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCriarOcorrenciaTeste('critica')}
                disabled={creatingTest}
                className="corporate-btn bg-red-700 hover:bg-red-800 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Simular P1 (Conduta/Jacto)</span>
              </button>

              <button
                onClick={() => handleCriarOcorrenciaTeste('media')}
                disabled={creatingTest}
                className="corporate-btn bg-amber-700 hover:bg-amber-800 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simular P3 (Passeio/Fluxo)</span>
              </button>

              <button
                onClick={() => handleCriarOcorrenciaTeste('baixa')}
                disabled={creatingTest}
                className="corporate-btn bg-zinc-700 hover:bg-zinc-600 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simular P5 (Gotas/Ramal)</span>
              </button>

              <button
                onClick={() => handleCriarOcorrenciaTeste('sem_fuga')}
                disabled={creatingTest}
                className="corporate-btn bg-rose-700 hover:bg-rose-800 text-white h-8 px-3 py-1 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                title="Gera relatório com foto sem água para ensaio de rejeição automática"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Simular Sem Fuga (Rejeição IA)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. BARRA DE FILTROS & BUSCA (TOOLSTRIP) */}
        <div className="bg-zinc-900 border border-zinc-800 corporate-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <label htmlFor="prio-select" className="text-xs font-bold text-zinc-300 font-mono">Prioridade:</label>
              <select
                id="prio-select"
                value={filterPrioridade}
                onChange={(e) => setFilterPrioridade(e.target.value)}
                className="corporate-input bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 font-semibold text-zinc-100"
              >
                <option value="TODAS">Todas (P1 a P5)</option>
                <option value="P1">P1 — Crítica</option>
                <option value="P2">P2 — Alta</option>
                <option value="P3">P3 — Média</option>
                <option value="P4">P4 — Baixa</option>
                <option value="P5">P5 — Mínima</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="status-select" className="text-xs font-bold text-zinc-300 font-mono">Status:</label>
              <select
                id="status-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="corporate-input bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 font-semibold text-zinc-100"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="pendente">Pendente na Triagem</option>
                <option value="em_validacao">Em Validação</option>
                <option value="validado">Validado (No Mapa GIS)</option>
                <option value="em_progresso">Em Progresso</option>
                <option value="resolvido">Resolvido</option>
                <option value="rejeitado">Descartado (Fora de Âmbito)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por ID, contacto, local..."
                className="corporate-input bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 font-mono w-56 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400 font-mono">
              A exibir <strong className="text-zinc-100">{ocorrenciasFiltradas.length}</strong> de {ocorrencias.length} registos
            </span>

            {ocorrencias.length > 0 && (
              <button
                onClick={handleLimparFila}
                className="corporate-btn bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-800 px-2.5 py-1 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Limpar todas as ocorrências da fila de triagem"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Limpar Fila</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. GRELHA DE OCORRÊNCIAS COM DIVISÃO ATIVAS VS HISTÓRICO ATENDIDO */}
        {loading && ocorrencias.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 corporate-card p-12 text-center text-zinc-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-xs font-bold font-mono">A carregar registos do banco de dados...</p>
          </div>
        ) : ocorrenciasFiltradas.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 corporate-card p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-zinc-800/80 border border-zinc-700 corporate-card flex items-center justify-center mx-auto text-zinc-400">
              <FileText className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200 font-mono uppercase tracking-wider">
                {ocorrencias.length === 0 ? 'Fila de Triagem Vazia' : 'Nenhum registo corresponde aos filtros'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                {ocorrencias.length === 0
                  ? 'A fila de triagem está limpa. Não existem ocorrências fixas ou pendentes no momento. Novos reportes do cidadão ou ensaios simulados aparecerão aqui em tempo real.'
                  : 'Nenhuma ocorrência encontrada com os filtros de status e prioridade selecionados.'}
              </p>
            </div>
            {ocorrencias.length === 0 ? (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => handleCriarOcorrenciaTeste('critica')}
                  disabled={creatingTest}
                  className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Simular Fuga de Teste</span>
                </button>
                <Link
                  href="/reportar"
                  className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>Canal Público de Reporte</span>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => {
                  setFilterPrioridade('TODAS')
                  setFilterStatus('TODOS')
                  setSearchQuery('')
                }}
                className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-1.5 text-xs font-semibold"
              >
                Limpar Filtros Ativos
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* SEÇÃO 1: FILA DE TRIAGEM ATIVA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-3 py-1.5 corporate-card">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  Fila de Triagem Ativa & Em Aberto ({ocorrenciasAtivas.length})
                </span>
                <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                  Ordenado por prioridade crítica (P1 &rarr; P5) e antiguidade
                </span>
              </div>

              {ocorrenciasAtivas.length === 0 ? (
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 text-center text-xs text-zinc-400 corporate-card">
                  Nenhuma ocorrência pendente na fila ativa com os filtros atuais.
                </div>
              ) : (
                ocorrenciasAtivas.map((ocorrencia) => renderCard(ocorrencia, false))
              )}
            </div>

            {/* SEÇÃO 2: HISTÓRICO DE OCORRÊNCIAS ATENDIDAS & CONCLUÍDAS (NO FIM) */}
            {ocorrenciasAtendidas.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-3 py-1.5 corporate-card">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                      Histórico de Ocorrências Atendidas & Concluídas ({ocorrenciasAtendidas.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                    Casos resolvidos ou rejeitados mantidos para auditoria
                  </span>
                </div>

                {ocorrenciasAtendidas.map((ocorrencia) => renderCard(ocorrencia, true))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: LIGHTBOX DE AMPLIAÇÃO DA FOTO */}
      {modalFotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setModalFotoUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center bg-zinc-950 border border-zinc-800 corporate-card p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-zinc-200 p-2 font-mono text-xs border-b border-zinc-800">
              <span className="font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                Imagem da Ocorrência
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={modalFotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-xs font-mono flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Original</span>
                </a>
                <button
                  onClick={() => setModalFotoUrl(null)}
                  className="corporate-btn bg-zinc-800 hover:bg-red-700 text-zinc-200 hover:text-white p-1"
                  title="Fechar visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-hidden max-h-[75vh] flex items-center justify-center w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modalFotoUrl}
                alt="Fotografia ampliada"
                className="max-h-[72vh] max-w-full object-contain border border-zinc-800"
              />
            </div>
            <div className="w-full text-center text-[11px] text-zinc-500 font-mono py-1">
              Pressione ESC ou clique fora da imagem para fechar
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES COMPLETOS DA OCORRÊNCIA (DADOS DO CIDADÃO) */}
      {detalhesOcorrencia && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs"
          onClick={() => setDetalhesOcorrencia(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 corporate-card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* BARRA DE TÍTULO MODAL */}
            <div className="bg-zinc-850 px-4 py-2.5 border-b border-zinc-700 flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-zinc-100">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Ficha de Detalhes da Ocorrência — #{detalhesOcorrencia.id.substring(0, 8).toUpperCase()}
              </span>
              <button
                onClick={() => setDetalhesOcorrencia(null)}
                className="text-zinc-400 hover:text-zinc-100"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CORPO DO MODAL SCROLLÁVEL */}
            <div className="p-4 space-y-4 overflow-y-auto corporate-scrollbar text-xs">
              {/* FOTO E RESUMO RÁPIDO */}
              <div className="flex flex-col sm:flex-row gap-4 border-b border-zinc-800 pb-4">
                {detalhesOcorrencia.foto_expirada || detalhesOcorrencia.foto_url === 'retencao_expirada_48h' ? (
                  <div className="w-full sm:w-48 h-36 bg-zinc-950 border border-zinc-800 corporate-card flex flex-col items-center justify-center p-3 text-center text-zinc-500 shrink-0">
                    <Clock className="w-6 h-6 text-zinc-600 mb-1" />
                    <span className="text-[11px] font-mono font-bold uppercase text-zinc-400">Foto Expurgada</span>
                    <span className="text-[10px] text-zinc-600 font-mono">Retenção de 48 Horas</span>
                    <span className="text-[9px] text-zinc-600 mt-1">Conforme política de privacidade</span>
                  </div>
                ) : (
                  <div
                    onClick={() => setModalFotoUrl(detalhesOcorrencia.foto_url)}
                    className="w-full sm:w-48 h-36 bg-zinc-950 border border-zinc-700 corporate-card overflow-hidden cursor-pointer relative group shrink-0"
                    title="Clique para ampliar a fotografia"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detalhesOcorrencia.foto_url}
                      alt="Foto da ocorrência"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ampliar</span>
                    </div>
                  </div>
                )}

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-400 font-mono">Protocolo Completo:</span>
                    <span className="font-mono font-bold text-zinc-100 bg-zinc-800 px-2 py-0.5 border border-zinc-700">
                      {detalhesOcorrencia.id}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-zinc-800/60 p-2 border border-zinc-800">
                      <span className="text-zinc-400 block">SUBMISSÃO (CAT UTC+2):</span>
                      <strong className="text-zinc-100">
                        {new Date(detalhesOcorrencia.criado_em).toLocaleString('pt-MZ', {
                          timeZone: 'Africa/Maputo',
                        })}
                      </strong>
                    </div>
                    <div className="bg-zinc-800/60 p-2 border border-zinc-800">
                      <span className="text-zinc-400 block">ESTADO ATUAL:</span>
                      <strong className="text-blue-400 uppercase">
                        {detalhesOcorrencia.status.replace(/_/g, ' ')}
                      </strong>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Prioridade Determinada:{' '}
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.prioridade ? PRIORITY_TOKENS[detalhesOcorrencia.prioridade]?.label : 'Aguardando'}
                    </strong>{' '}
                    | Score: <strong className="text-zinc-100">{detalhesOcorrencia.priority_score ?? 'N/D'}/100</strong>
                  </div>
                </div>
              </div>

              {/* SEÇÃO: QUESTIONÁRIO E INFORMAÇÕES DO CIDADÃO */}
              <div className="win-groupbox space-y-2.5">
                <legend>Informações Submetidas pelo Cidadão</legend>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Contacto do Reportante:
                    </span>
                    <span className="text-zinc-100 font-semibold">
                      {detalhesOcorrencia.contacto_cliente || 'Não fornecido'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Local Físico da Fuga:
                    </span>
                    <span className="text-zinc-100 font-semibold">
                      {detalhesOcorrencia.local_fuga === 'conduta'
                        ? 'Via Pública / Rua (Conduta Principal)'
                        : detalhesOcorrencia.local_fuga === 'passeio'
                        ? 'Passeio Público / Valeta'
                        : detalhesOcorrencia.local_fuga === 'dentro_residencia'
                        ? 'No interior da residência / quintal'
                        : detalhesOcorrencia.local_fuga || 'Não especificado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Água a Sair no Momento:
                    </span>
                    <span className={`font-semibold ${detalhesOcorrencia.agua_saindo_agora ? 'text-blue-400' : 'text-zinc-400'}`}>
                      {detalhesOcorrencia.agua_saindo_agora ? 'Sim — Água corrente ativa' : 'Não — Parada / Seca'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Intensidade do Fluxo:
                    </span>
                    <span className="text-zinc-100 font-semibold">
                      {detalhesOcorrencia.intensidade_reportada === 'jacto'
                        ? 'Jacto violento com pressão'
                        : detalhesOcorrencia.intensidade_reportada === 'fluxo_forte'
                        ? 'Fluxo contínuo forte'
                        : detalhesOcorrencia.intensidade_reportada === 'gotas'
                        ? 'Gotas / Vazamento lento'
                        : detalhesOcorrencia.intensidade_reportada || 'Não especificado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Impacto em Terceiros:
                    </span>
                    <span className="text-zinc-100 font-semibold">
                      {detalhesOcorrencia.afeta_outros === 'rua_zona'
                        ? 'Toda a rua / quarteirão afetado'
                        : detalhesOcorrencia.afeta_outros === 'uma_residencia'
                        ? 'Apenas uma residência'
                        : detalhesOcorrencia.afeta_outros === 'nao'
                        ? 'Sem impacto vizinhança'
                        : detalhesOcorrencia.afeta_outros || 'Não especificado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Tipo de Pavimento:
                    </span>
                    <span className="text-zinc-100 font-semibold">
                      {detalhesOcorrencia.tipo_pavimento === 'asfalto'
                        ? 'Asfalto / Faixa de Rodagem'
                        : detalhesOcorrencia.tipo_pavimento === 'calcada'
                        ? 'Calçada / Passeio pavimentado'
                        : detalhesOcorrencia.tipo_pavimento === 'terra'
                        ? 'Terra batida'
                        : detalhesOcorrencia.tipo_pavimento || 'Outro / Não especificado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono">
                      Risco de Acidente Reportado:
                    </span>
                    <span className={`font-semibold ${detalhesOcorrencia.risco_acidente ? 'text-red-400' : 'text-zinc-400'}`}>
                      {detalhesOcorrencia.risco_acidente
                        ? 'Sim — Risco para trânsito ou transeuntes'
                        : 'Não reportado'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono mb-1">
                    Observações Textuais do Cidadão:
                  </span>
                  <div className="bg-zinc-950 p-2.5 border border-zinc-800 text-zinc-200 leading-relaxed font-sans corporate-card">
                    {detalhesOcorrencia.observacoes_cliente || 'Nenhuma observação adicional foi indicada na submissão.'}
                  </div>
                </div>
              </div>

              {/* SEÇÃO: GEOLOCALIZAÇÃO E COORDENADAS */}
              <div className="win-groupbox">
                <legend>Posicionamento & Coordenadas Geográficas</legend>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 font-mono text-xs">
                  <div className="space-y-1">
                    <div>
                      <span className="text-zinc-400">Latitude:</span>{' '}
                      <strong className="text-zinc-100">{detalhesOcorrencia.latitude ?? 'N/D'}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Longitude:</span>{' '}
                      <strong className="text-zinc-100">{detalhesOcorrencia.longitude ?? 'N/D'}</strong>
                    </div>
                  </div>

                  {detalhesOcorrencia.latitude && detalhesOcorrencia.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${detalhesOcorrencia.latitude},${detalhesOcorrencia.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 flex items-center gap-1.5 border border-zinc-700 font-sans"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>Abrir no Google Maps</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    </a>
                  )}
                </div>
              </div>

              {/* SEÇÃO: PARECER TÉCNICO DA IA & GIS */}
              <div className="win-groupbox space-y-2">
                <legend>Classificação Determinística Gemini Vision & GIS</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-zinc-950 p-2 border border-zinc-800">
                    <span className="text-zinc-400 block">INFRAESTRUTURA:</span>
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.classificacao_gemini?.infrastructure_type || 'Pendente'}
                    </strong>
                  </div>
                  <div className="bg-zinc-950 p-2 border border-zinc-800">
                    <span className="text-zinc-400 block">CONFIANÇA / FUGA:</span>
                    <strong className="text-blue-400">
                      {detalhesOcorrencia.classificacao_gemini?.confidence !== undefined
                        ? `${Math.round(detalhesOcorrencia.classificacao_gemini.confidence * 100)}% (${detalhesOcorrencia.classificacao_gemini.is_leak ? 'Fuga Detectada' : 'Sem Fuga'})`
                        : 'Pendente'}
                    </strong>
                  </div>
                  <div className="bg-zinc-950 p-2 border border-zinc-800">
                    <span className="text-zinc-400 block">CAUDAL OBSERVADO:</span>
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.classificacao_gemini?.water_flow || 'Pendente'}
                    </strong>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block font-mono mb-1">
                    Justificativa Computacional:
                  </span>
                  <p className="bg-zinc-950 p-2.5 border border-zinc-800 text-zinc-300 leading-relaxed font-sans corporate-card">
                    {detalhesOcorrencia.classificacao_gemini?.reason ||
                      detalhesOcorrencia.motivo_rejeicao ||
                      'Aguardando classificação automatizada.'}
                  </p>
                </div>
              </div>

              {/* SEÇÃO: AUDITORIA E DESPACHO */}
              <div className="win-groupbox">
                <legend>Registo de Despacho & Auditoria</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-zinc-400">Validado por:</span>{' '}
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.validado_por || 'Ainda não validado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400">Equipa Atribuída:</span>{' '}
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.equipa_atribuida || 'Nenhuma'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400">SLA Limite:</span>{' '}
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.sla_limite
                        ? new Date(detalhesOcorrencia.sla_limite).toLocaleString('pt-MZ', {
                            timeZone: 'Africa/Maputo',
                          })
                        : 'N/D'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400">Escalonada de SLA:</span>{' '}
                    <strong className="text-zinc-100">
                      {detalhesOcorrencia.escalonada ? `Sim (Original: ${detalhesOcorrencia.prioridade_original})` : 'Não'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="bg-zinc-850 px-4 py-2.5 border-t border-zinc-700 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-mono">
                Consola CCO Maputo / Matola
              </span>
              <div className="flex items-center gap-2">
                {detalhesOcorrencia.status !== 'validado' && (
                  <button
                    onClick={() => {
                      const id = detalhesOcorrencia.id
                      setDetalhesOcorrencia(null)
                      setValidatingId(id)
                    }}
                    className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1 flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Validar Esta Ocorrência</span>
                  </button>
                )}
                <button
                  onClick={() => setDetalhesOcorrencia(null)}
                  className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-1"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
