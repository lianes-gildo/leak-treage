'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Clock,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Users2,
  ArrowRight,
  CheckCheck,
} from 'lucide-react'
import Link from 'next/link'
import { Notificacao, TipoNotificacao } from '@/types/ocorrencia'

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLida, setFilterLida] = useState<'TODAS' | 'NAO_LIDAS' | 'LIDAS'>('TODAS')
  const [filterTipo, setFilterTipo] = useState<string>('TODOS')
  const [searchQuery, setSearchQuery] = useState('')
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const [mensagemAcao, setMensagemAcao] = useState<string | null>(null)

  const carregarNotificacoes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notificacoes')
      const json = await res.json()
      if (res.ok && json.data) {
        setNotificacoes(json.data)
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarNotificacoes()
    }, 0)
    return () => clearTimeout(timer)
  }, [carregarNotificacoes])

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
    } catch (err) {
      console.error('Erro ao marcar notificação:', err)
    }
  }

  const handleMarcarTodasLidas = async () => {
    setMarcandoTodas(true)
    try {
      const res = await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todas: true }),
      })
      if (res.ok) {
        setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
        setMensagemAcao('Todas as notificações foram marcadas como lidas.')
        setTimeout(() => setMensagemAcao(null), 3500)
      }
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err)
    } finally {
      setMarcandoTodas(false)
    }
  }

  const getTipoBadge = (tipo: TipoNotificacao) => {
    switch (tipo) {
      case 'nova_urgente':
        return {
          label: 'URGENTE P1',
          bg: 'bg-red-950 text-red-200 border-red-800',
          icon: ShieldAlert,
        }
      case 'escalonada':
        return {
          label: 'ESCALONADA',
          bg: 'bg-orange-950 text-orange-200 border-orange-800',
          icon: AlertTriangle,
        }
      case 'grupo_amplificado':
        return {
          label: 'AMPLIFICADA',
          bg: 'bg-purple-950 text-purple-200 border-purple-800',
          icon: Flame,
        }
      case 'atribuicao_pendente':
        return {
          label: 'EQUIPA ATRIBUÍDA',
          bg: 'bg-emerald-950 text-emerald-200 border-emerald-800',
          icon: Users2,
        }
      default:
        return {
          label: 'SISTEMA',
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          icon: Bell,
        }
    }
  }

  const notificacoesFiltradas = notificacoes.filter((item) => {
    if (filterLida === 'NAO_LIDAS' && item.lida) return false
    if (filterLida === 'LIDAS' && !item.lida) return false
    if (filterTipo !== 'TODOS' && item.tipo !== filterTipo) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchTitulo = (item.titulo || '').toLowerCase().includes(q)
      const matchMsg = (item.mensagem || '').toLowerCase().includes(q)
      const matchOc = (item.ocorrencia_id || '').toLowerCase().includes(q)
      return matchTitulo || matchMsg || matchOc
    }
    return true
  })

  const totalNaoLidas = notificacoes.filter((n) => !n.lida).length

  return (
    <div className="space-y-4">
      {/* 1. BARRA DE TÍTULO WINDOWS FORMS */}
      <div className="bg-zinc-900 border border-zinc-800 corporate-card px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase font-mono">
              Central de Notificações Operacionais
            </span>
            <span className="text-zinc-500 mx-1.5">|</span>
            <span className="text-zinc-400 font-mono text-[11px]">
              Total: {notificacoes.length} alertas ({totalNaoLidas} não lidos)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalNaoLidas > 0 && (
            <button
              type="button"
              onClick={handleMarcarTodasLidas}
              disabled={marcandoTodas}
              title="Marcar todos os alertas operacionais como lidos"
              className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{marcandoTodas ? 'A Processar...' : 'Marcar Todas como Lidas'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => carregarNotificacoes()}
            disabled={loading}
            title="Atualizar lista de notificações do servidor"
            className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {mensagemAcao && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-2.5 corporate-card text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{mensagemAcao}</span>
        </div>
      )}

      {/* 2. BARRA DE FILTROS E PESQUISA */}
      <div className="bg-zinc-900 border border-zinc-800 corporate-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 border border-zinc-700 corporate-card">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-zinc-400 text-[10px] uppercase font-mono">Estado:</span>
            <select
              value={filterLida}
              onChange={(e) => setFilterLida(e.target.value as 'TODAS' | 'NAO_LIDAS' | 'LIDAS')}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="TODAS" className="bg-zinc-900 text-white">Todas ({notificacoes.length})</option>
              <option value="NAO_LIDAS" className="bg-zinc-900 text-white">Apenas Não Lidas ({totalNaoLidas})</option>
              <option value="LIDAS" className="bg-zinc-900 text-white">Apenas Lidas ({notificacoes.length - totalNaoLidas})</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 border border-zinc-700 corporate-card">
            <span className="font-bold text-zinc-400 text-[10px] uppercase font-mono">Tipo:</span>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="TODOS" className="bg-zinc-900 text-white">Todos os Tipos</option>
              <option value="nova_urgente" className="bg-zinc-900 text-white">Urgente (P1)</option>
              <option value="escalonada" className="bg-zinc-900 text-white">Escalonamento SLA</option>
              <option value="grupo_amplificado" className="bg-zinc-900 text-white">Grupo Amplificado</option>
              <option value="atribuicao_pendente" className="bg-zinc-900 text-white">Atribuição de Equipa</option>
            </select>
          </div>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por título, mensagem ou ocorrência..."
            className="corporate-input w-full bg-zinc-800 border border-zinc-700 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500"
          />
        </div>
      </div>

      {/* 3. LISTA DE NOTIFICAÇÕES (DESKTOP DATAGRID / LISTVIEW) */}
      <div className="bg-zinc-900 border border-zinc-800 corporate-card overflow-hidden">
        {loading && notificacoes.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 font-mono">
            A carregar histórico completo de notificações...
          </div>
        ) : notificacoesFiltradas.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <div className="text-sm font-bold text-zinc-300">Nenhuma notificação encontrada</div>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Não existem notificações correspondentes aos critérios de filtro aplicados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {notificacoesFiltradas.map((notif) => {
              const badge = getTipoBadge(notif.tipo)
              const Icone = badge.icon
              const dataFormatada = new Date(notif.criado_em).toLocaleString('pt-MZ', {
                timeZone: 'Africa/Maputo',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={notif.id}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-none ${
                    notif.lida
                      ? 'bg-zinc-900/60 opacity-80 hover:bg-zinc-800/40'
                      : 'bg-zinc-900 hover:bg-zinc-850 border-l-4 border-l-blue-600'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-1.5 corporate-card shrink-0 mt-0.5 border ${badge.bg}`}
                    >
                      <Icone className="w-4 h-4" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border corporate-badge ${badge.bg}`}
                        >
                          {badge.label}
                        </span>

                        {!notif.lida ? (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-blue-900 text-blue-200 border border-blue-700 corporate-badge">
                            NÃO LIDA
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-zinc-500 px-1 py-0 border border-zinc-800 corporate-badge">
                            LIDA
                          </span>
                        )}

                        <span className="text-xs font-bold text-white truncate">
                          {notif.titulo}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed max-w-3xl">
                        {notif.mensagem}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 font-mono pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{dataFormatada} (CAT)</span>
                        </span>

                        {notif.papel_alvo && (
                          <span>Destino: Operador {notif.papel_alvo.toUpperCase()}</span>
                        )}

                        {notif.ocorrencia_id && (
                          <span className="text-blue-400">
                            ID: {notif.ocorrencia_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!notif.lida && (
                      <button
                        type="button"
                        onClick={() => handleMarcarLida(notif.id)}
                        title="Marcar esta notificação como lida"
                        className="corporate-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs px-2.5 py-1 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Marcar Lida</span>
                      </button>
                    )}

                    {notif.ocorrencia_id && (
                      <Link
                        href={`/dashboard?busca=${encodeURIComponent(notif.ocorrencia_id)}`}
                        title="Abrir a ocorrência correspondente na Consola de Triagem"
                        className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-2.5 py-1 flex items-center gap-1"
                      >
                        <span>Ver Ocorrência</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
