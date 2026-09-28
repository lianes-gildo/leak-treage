'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  SlidersHorizontal,
  Clock,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Zap,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Save,
  X,
} from 'lucide-react'
import { ConfiguracaoPrioridade, Prioridade } from '@/types/ocorrencia'

export default function PrioridadesPage() {
  const [matriz, setMatriz] = useState<ConfiguracaoPrioridade[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoPrio, setEditandoPrio] = useState<Prioridade | null>(null)
  const [editSla, setEditSla] = useState(0)
  const [editDescricao, setEditDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const carregarMatriz = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/prioridades')
      const json = await res.json()
      if (res.ok && json.data) {
        setMatriz(json.data)
      }
    } catch (err) {
      console.error('Erro ao buscar matriz de prioridades:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarMatriz()
    }, 0)
    return () => clearTimeout(timer)
  }, [carregarMatriz])

  const abrirEdicao = (cfg: ConfiguracaoPrioridade) => {
    setEditandoPrio(cfg.prioridade)
    setEditSla(cfg.sla_horas)
    setEditDescricao(cfg.descricao)
  }

  const salvarEdicao = async (prio: Prioridade) => {
    setSalvando(true)
    try {
      const res = await fetch('/api/prioridades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prioridade: prio,
          sla_horas: Number(editSla),
          descricao: editDescricao,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gravar alteração.')
      setFeedbackMsg(`Política de SLA para ${prio} atualizada com sucesso.`)
      setEditandoPrio(null)
      await carregarMatriz()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(msg)
    } finally {
      setSalvando(false)
    }
  }

  const getIcon = (prio: Prioridade) => {
    switch (prio) {
      case 'P1':
        return Flame
      case 'P2':
        return ShieldAlert
      case 'P3':
        return AlertTriangle
      case 'P4':
        return Zap
      case 'P5':
        return CheckCircle2
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER DO MÓDULO */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-700 text-white p-1 corporate-card">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              Matriz Operacional de Prioridades & Políticas de SLA
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Regras de contingência, pisos de escalonamento temporal e encaminhamento determinístico de despacho SAAS.
          </p>
        </div>

        <button
          onClick={carregarMatriz}
          disabled={loading}
          className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recarregar Parâmetros</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-3 corporate-card text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-700 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* REGRAS RÍGIDAS DE SOBREPOSIÇÃO (HARD OVERRIDES) */}
      <div className="win-groupbox">
        <legend className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase font-mono flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-blue-700" />
          <span>Regras Rígidas de Sobreposição (Hard Overrides de Engenharia)</span>
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 corporate-card">
            <span className="font-bold text-red-900 dark:text-red-300 block font-mono">1. OVERRIDE DE RISCO CRÍTICO</span>
            <p className="text-[11px] text-red-800 dark:text-red-200 mt-1 leading-relaxed">
              Se `risco_humano` ou `risco_patrimonio` = crítico, a ocorrência é forçada imediatamente a **P1 (Score 100)** sem esperar média ponderada.
            </p>
          </div>

          <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 corporate-card">
            <span className="font-bold text-orange-900 dark:text-orange-300 block font-mono">2. ADUTORA COM JACTO</span>
            <p className="text-[11px] text-orange-800 dark:text-orange-200 mt-1 leading-relaxed">
              Infraestrutura = conduta adutora (5) com caudal = jacto sob pressão (4+) é forçada a **P1**, com notificação ao supervisor e piquete central.
            </p>
          </div>

          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 corporate-card">
            <span className="font-bold text-purple-900 dark:text-purple-300 block font-mono">3. AMPLIFICAÇÃO POR VOLUME</span>
            <p className="text-[11px] text-purple-800 dark:text-purple-200 mt-1 leading-relaxed">
              Agrupamentos geográficos (&lt;50m) com &gt;=10 reportes escalam para piso **P1**, sinalizando desastre hidráulico ou alagamento de bairro.
            </p>
          </div>
        </div>
      </div>

      {/* GRELHA DE NÍVEIS P1 A P5 (ESTILO DATAGRID / FORM WINDOWS) */}
      <div className="space-y-3">
        {matriz.map((item) => {
          const Icon = getIcon(item.prioridade)
          const isEditando = editandoPrio === item.prioridade

          return (
            <div
              key={item.prioridade}
              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-4 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`${item.cor_badge} px-2.5 py-1 text-xs font-bold font-mono corporate-badge flex items-center gap-1.5 shadow-2xs`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.prioridade} — {item.nome}</span>
                  </span>

                  <div className="flex items-center gap-1 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-blue-700" />
                    <span>Prazo SLA Limite:</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                      {item.sla_horas === 0 ? 'Imediato (0 Horas)' : `${item.sla_horas} Horas`}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 font-mono corporate-badge">
                    {item.tipo_despacho}
                  </span>

                  {!isEditando ? (
                    <button
                      onClick={() => abrirEdicao(item)}
                      className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configurar SLA</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditandoPrio(null)}
                      className="corporate-btn bg-zinc-200 text-zinc-700 px-2 py-1 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* PAINEL DE EDIÇÃO INLINE SE ATIVO */}
              {isEditando ? (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-zinc-800/90 border border-blue-600 corporate-card space-y-3">
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-200 font-mono uppercase">
                    Ajustar Parâmetros da Política {item.prioridade}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold block text-zinc-700 dark:text-zinc-300 mb-1">
                        Tempo Limite de Atendimento (Horas):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={editSla}
                        onChange={(e) => setEditSla(Number(e.target.value))}
                        className="corporate-input w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold block text-zinc-700 dark:text-zinc-300 mb-1">
                        Descrição Operacional:
                      </label>
                      <input
                        type="text"
                        value={editDescricao}
                        onChange={(e) => setEditDescricao(e.target.value)}
                        className="corporate-input w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => salvarEdicao(item.prioridade)}
                      disabled={salvando}
                      className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{salvando ? 'A Gravar...' : 'Gravar Alterações'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="md:col-span-2 space-y-1">
                    <span className="font-bold text-zinc-600 dark:text-zinc-400 block text-[11px] font-mono uppercase">
                      Diretriz Operacional:
                    </span>
                    <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item.descricao}
                    </p>
                  </div>

                  <div className="space-y-1 border-l border-zinc-200 dark:border-zinc-800 pl-3">
                    <span className="font-bold text-zinc-600 dark:text-zinc-400 block text-[11px] font-mono uppercase">
                      Critérios do Motor:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                      {item.criterios.map((crit, i) => (
                        <li key={i}>{crit}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
