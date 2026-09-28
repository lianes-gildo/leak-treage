'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileCheck2,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Shield,
  User,
  Eye,
  X,
} from 'lucide-react'
import { AuditoriaOcorrencia } from '@/types/ocorrencia'

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditoriaOcorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAutor, setFilterAutor] = useState('')
  const [filterTipo, setFilterTipo] = useState('TODOS')
  const [logSelecionado, setLogSelecionado] = useState<AuditoriaOcorrencia | null>(null)

  const carregarLogs = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/auditoria'
      const params = new URLSearchParams()
      if (filterAutor) params.set('autor', filterAutor)
      if (filterTipo !== 'TODOS') params.set('tipo', filterTipo)
      if (params.toString()) url += `?${params.toString()}`

      const res = await fetch(url)
      const json = await res.json()
      if (res.ok && json.data) {
        setLogs(json.data)
      }
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err)
    } finally {
      setLoading(false)
    }
  }, [filterAutor, filterTipo])

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarLogs()
    }, 0)
    return () => clearTimeout(timer)
  }, [carregarLogs])

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'classificacao_inicial':
        return 'bg-blue-100 text-blue-900 border-blue-300'
      case 'correcao_manual':
        return 'bg-amber-100 text-amber-900 border-amber-300'
      case 'atribuicao_equipa':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300'
      case 'mudanca_status':
        return 'bg-purple-100 text-purple-900 border-purple-300'
      case 'escalonamento_sla':
        return 'bg-red-100 text-red-900 border-red-300'
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300'
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER DO MÓDULO */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-700 text-white p-1 corporate-card">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              Trilha de Auditoria & Livro de Registos Imutáveis
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Histórico cronológico de decisões, intervenções humanas, reclassificações e despachos operacionais SAAS.
          </p>
        </div>

        <button
          onClick={carregarLogs}
          disabled={loading}
          className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Trilha</span>
        </button>
      </div>

      {/* BARRA DE FILTROS ESTILO TOOLSTRIP */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <label className="font-bold text-zinc-700 dark:text-zinc-300">Tipo de Evento:</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="corporate-input bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 font-semibold"
            >
              <option value="TODOS">Todos os Eventos</option>
              <option value="classificacao_inicial">Classificação Inicial (IA)</option>
              <option value="correcao_manual">Correção Manual (Operador)</option>
              <option value="atribuicao_equipa">Atribuição de Equipa</option>
              <option value="mudanca_status">Mudança de Estado</option>
              <option value="escalonamento_sla">Escalonamento SLA</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={filterAutor}
              onChange={(e) => setFilterAutor(e.target.value)}
              placeholder="Filtrar por autor ou sistema..."
              className="corporate-input bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 w-52 font-mono"
            />
          </div>
        </div>

        <div className="font-mono text-zinc-500 text-[11px]">
          Total de Eventos Registados: <strong className="text-zinc-900 dark:text-zinc-100">{logs.length}</strong>
        </div>
      </div>

      {/* TABELA DE AUDITORIA (WINDOWS FORMS EVENT VIEWER) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-300 dark:border-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 font-mono uppercase">
                <th className="p-3">Data / Hora (CAT)</th>
                <th className="p-3">Evento</th>
                <th className="p-3">Alvo / Ocorrência</th>
                <th className="p-3">Autor da Ação</th>
                <th className="p-3">Justificação Operacional</th>
                <th className="p-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="p-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{new Date(log.criado_em).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' })}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold corporate-badge uppercase border ${getTipoBadge(
                        log.tipo_evento
                      )}`}
                    >
                      {log.tipo_evento.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[11px]">
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 corporate-badge font-bold">
                      {log.ocorrencia_id.substring(0, 14)}
                    </span>
                  </td>
                  <td className="p-3 text-[11px]">
                    <div className="flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200">
                      <User className="w-3 h-3 text-blue-700" />
                      <span>{log.autor}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[11px] text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                    {log.motivo}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setLogSelecionado(log)}
                      className="p-1 text-zinc-600 hover:text-blue-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 corporate-card"
                      title="Ver valores anteriores e posteriores"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHES DE AUDITORIA */}
      {logSelecionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border-2 border-blue-800 corporate-card max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="font-bold font-mono text-xs uppercase text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-700" />
                Registo de Auditoria #{logSelecionado.id}
              </span>
              <button onClick={() => setLogSelecionado(null)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 corporate-card font-mono text-[11px]">
                <div>
                  <span className="text-zinc-500 block">Autor da Modificação:</span>
                  <strong className="text-zinc-900 dark:text-zinc-100">{logSelecionado.autor}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">Data e Hora Oficial (CAT):</span>
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {new Date(logSelecionado.criado_em).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' })}
                  </strong>
                </div>
              </div>

              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Justificação / Motivo Operacional:
                </span>
                <p className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 corporate-card text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {logSelecionado.motivo}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-zinc-600 dark:text-zinc-400 block mb-1 font-mono uppercase text-[11px]">
                    Estado / Valor Anterior:
                  </span>
                  <pre className="p-2 bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-[10px] overflow-auto max-h-40 corporate-card">
                    {JSON.stringify(logSelecionado.valor_anterior, null, 2) || 'null (Primeiro Registo)'}
                  </pre>
                </div>
                <div>
                  <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1 font-mono uppercase text-[11px]">
                    Novo Estado / Valor Aplicado:
                  </span>
                  <pre className="p-2 bg-zinc-100 dark:bg-zinc-950 border border-blue-300 dark:border-blue-900 font-mono text-[10px] overflow-auto max-h-40 corporate-card text-blue-900 dark:text-blue-200">
                    {JSON.stringify(logSelecionado.valor_novo, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setLogSelecionado(null)}
                  className="corporate-btn bg-zinc-800 text-white px-4 py-1.5 font-bold"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
