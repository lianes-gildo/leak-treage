'use client'

import { useState, useEffect, useCallback } from 'react'
import { MetricasQualidade } from '@/lib/metricas'
import {
  BarChart3,
  CheckCircle2,
  Database,
  Bot,
  Calendar,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Layers,
} from 'lucide-react'
import Link from 'next/link'

export default function MetricasPage() {
  const [diasPeriodo, setDiasPeriodo] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState<MetricasQualidade>({
    total: 0,
    concordancia_geral: 0,
    falsos_negativos_p1: 0,
    concordancia_por_fonte: { gis: 0, gemini: 0 },
  })

  const carregarMetricas = useCallback(async (dias: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/metricas?dias=${dias}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setMetricas(json.data)
      } else {
        console.error('Falha ao carregar métricas da API:', json.error)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro de ligação ao buscar métricas:', msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    fetch(`/api/metricas?dias=${diasPeriodo}`)
      .then((res) => res.json())
      .then((json) => {
        if (!ignore && json.data) {
          setMetricas(json.data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Erro ao carregar métricas:', err)
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [diasPeriodo])

  return (
    <div className="space-y-4">
      {/* HEADER DO MÓDULO */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <div className="bg-purple-700 text-white p-1 corporate-card">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono uppercase">
            Módulo de Qualidade do Modelo & Validação Humana
          </span>
          <span className="text-zinc-400">|</span>
          <span className="font-mono text-zinc-600 dark:text-zinc-400">Auditoria de Concordância SAAS</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar à Fila</span>
          </Link>
          <button
            onClick={() => carregarMetricas(diasPeriodo)}
            disabled={loading}
            className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>
        {/* SELETOR DE PERÍODO (ESTILO TOOLSTRIP) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <Calendar className="w-4 h-4 text-purple-700 dark:text-purple-400" />
            <span>Janela Temporal de Análise:</span>
          </div>

          <div className="flex gap-1.5">
            {[7, 30, 90].map((dias) => (
              <button
                key={dias}
                onClick={() => setDiasPeriodo(dias)}
                className={`corporate-btn text-xs font-bold px-3 py-1.5 border ${
                  diasPeriodo === dias
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Últimos {dias} Dias
              </button>
            ))}
          </div>
        </div>

        {/* CARTÕES DE MÉTRICAS PRINCIPAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TOTAL DE OCORRÊNCIAS COM FEEDBACK */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <span>Total de Validações Operacionais</span>
              <CheckCircle2 className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-3xl font-mono font-bold text-zinc-950 dark:text-white">
              {metricas.total}
            </div>
            <p className="text-[11px] text-zinc-500">
              Ocorrências com decisão confirmada por operadores humanos.
            </p>
          </div>

          {/* TAXA DE CONCORDÂNCIA GERAL */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <span>Concordância Geral (IA vs Operador)</span>
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {metricas.concordancia_geral}%
            </div>
            <p className="text-[11px] text-zinc-500">
              Percentual em que a sugestão do motor foi aprovada integralmente.
            </p>
          </div>

          {/* FALSOS NEGATIVOS DE P1 */}
          <div className="bg-white dark:bg-zinc-900 border-2 border-red-600 corporate-card p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
              <span>Falsos Negativos P1 (Risco Crítico)</span>
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-3xl font-mono font-bold text-red-700 dark:text-red-400">
              {metricas.falsos_negativos_p1}
            </div>
            <p className="text-[11px] text-red-700 dark:text-red-300">
              Casos onde o motor sugeriu P2+ mas o operador corrigiu para P1.
            </p>
          </div>
        </div>

        {/* COMPARATIVO POR ORIGEM DE DADOS (GIS vs GEMINI) */}
        <div className="win-groupbox">
          <legend>Desempenho por Origem dos Dados (Precedência GIS vs IA Pura)</legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="border border-zinc-200 dark:border-zinc-800 p-3 corporate-card bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>COM VINCULAÇÃO CADASTRO GIS (&le;30m)</span>
                </span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                  {metricas.concordancia_por_fonte.gis || 0}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 corporate-card overflow-hidden">
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${metricas.concordancia_por_fonte.gis || 0}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500">
                Ocorrências associadas a diâmetro real e infraestrutura do cadastro da concessionária.
              </p>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 p-3 corporate-card bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>EXCLUSIVAMENTE VISÃO GEMINI 2.5 FLASH</span>
                </span>
                <span className="font-mono text-amber-700 dark:text-amber-400 text-sm font-bold">
                  {metricas.concordancia_por_fonte.gemini || 0}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 corporate-card overflow-hidden">
                <div
                  className="bg-amber-600 h-full"
                  style={{ width: `${metricas.concordancia_por_fonte.gemini || 0}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500">
                Ocorrências sem ativo GIS próximo, dependentes de estimativa visual computacional.
              </p>
            </div>
          </div>
        </div>
    </div>
  )
}
