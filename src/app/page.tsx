import Link from 'next/link'
import {
  Activity,
  LayoutDashboard,
  Cpu,
  Droplets,
  BarChart3,
  Clock,
  ShieldCheck,
  Server,
  ArrowRight,
  Radio,
  FileCheck2,
} from 'lucide-react'

export default function Home() {
  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden flex flex-col bg-zinc-200 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none">
      {/* WINDOWS FORMS TITLE STRIP / MENUSTRIP - FIXO NO TOPO */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none shadow-2xs z-30">
        <div className="flex items-center gap-2">
          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono uppercase">
            SAAS
          </span>
          <span className="text-zinc-400">|</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Águas, Salubridade e Saneamento (Maputo) — Triagem Operacional de Fugas
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
          <span className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">PostgreSQL</span>
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Gemini 2.5</span>
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">RLS Ativo</span>
          </span>
        </div>
      </header>

      {/* WORKSPACE CENTRAL - ÚNICA ÁREA DE SCROLL */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain corporate-scrollbar p-4 sm:p-6 lg:p-8 select-text">
        <div className="max-w-6xl mx-auto w-full space-y-6 pb-12">
        {/* HERO BANNER ESTILO SISTEMA C# / WINDOWS FORMS */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest block font-mono">
                Plataforma de Despacho & Engenharia Sanitária
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white mt-1">
                Central de Controlo e Triagem de Fugas de Água
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2.5 text-xs flex items-center gap-2 tracking-wide"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Abrir Fila de Triagem</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/reportar"
                className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 font-bold px-4 py-2.5 text-xs flex items-center gap-2"
              >
                <Droplets className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Canal Público</span>
              </Link>
            </div>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-3xl">
            Gateway operacional de triagem de fugas de água. Recebe reportes de cidadãos, organiza por
            níveis de prioridade determinísticos (P1 a P5) com base em IA Gemini e cadastro de rede GIS.
            O operador aprova para transmissão imediata ao sistema externo do Mapa de Distribuição ou
            descarta ocorrências fora de âmbito.
          </p>
        </div>

        {/* GRELHA DE MÓDULOS OPERACIONAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MÓDULO 1: FILA DE TRABALHO */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
                <LayoutDashboard className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Fila de Triagem</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 corporate-badge">
                Operacional
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Fila de ocorrências em tempo real. O operador valida prioridades, aprova para envio ao mapa
              de distribuição ou descarta casos fora da rede.
            </p>
            <Link
              href="/dashboard"
              className="corporate-btn w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs py-2 px-3 flex items-center justify-center gap-1.5"
            >
              <span>Abrir Fila de Triagem</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* MÓDULO 2: CANAL CIDADÃO & UPLOAD */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
                <Droplets className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Canal Público de Reporte</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 corporate-badge">
                Cidadão
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Formulário público para submissão de fotografias de fugas com captura GPS, rate limit
              anti-spam (5/hora) e geração de número de protocolo.
            </p>
            <Link
              href="/reportar"
              className="corporate-btn w-full bg-zinc-800 hover:bg-zinc-900 text-white font-semibold text-xs py-2 px-3 flex items-center justify-center gap-1.5"
            >
              <span>Submeter Reporte</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* MÓDULO 3: MATRIZ DE PRIORIDADES */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                <span>Matriz de Prioridades</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 corporate-badge">
                Políticas
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Políticas de priorização P1 a P5, prazos de SLA por criticidade, critérios de override
              de risco e parâmetros de integração externa.
            </p>
            <Link
              href="/dashboard/prioridades"
              className="corporate-btn w-full bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs py-2 px-3 flex items-center justify-center gap-1.5"
            >
              <span>Ver Matriz P1–P5</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* PAINEL DE ESPECIFICAÇÕES TÉCNICAS DO SISTEMA */}
        <div className="win-groupbox">
          <legend>Arquitetura Determinística & Parâmetros de Rede</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
            <div className="border-l-2 border-blue-700 pl-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Priorização</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Escala P1 a P5</span>
              <span className="text-[11px] text-zinc-500 block">5 pesos + hard rules</span>
            </div>
            <div className="border-l-2 border-emerald-600 pl-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Camada GIS</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Raio 30 Metros</span>
              <span className="text-[11px] text-zinc-500 block">Precedência GIS &gt; IA</span>
            </div>
            <div className="border-l-2 border-amber-600 pl-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Deduplicação</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">50m / Janela 6h</span>
              <span className="text-[11px] text-zinc-500 block">Amplificação por volume</span>
            </div>
            <div className="border-l-2 border-purple-600 pl-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Controlo de SLA</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">P1=0h / P2=2h / P3=8h</span>
              <span className="text-[11px] text-zinc-500 block">Escalonamento ativo</span>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* STATUSSTRIP / BARRA DE STATUS INFERIOR - FIXO NA BASE */}
      <footer className="bg-zinc-300 dark:bg-zinc-900 border-t border-zinc-400 dark:border-zinc-800 px-4 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
            <Radio className="w-3 h-3" />
            <span>ESTADO: OPERACIONAL</span>
          </span>
          <span>|</span>
          <span>SAAS — ÁGUAS, SALUBRIDADE E SANEAMENTO (MAPUTO)</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>SLA Engine Ativo</span>
          </span>
          <span className="flex items-center gap-1">
            <FileCheck2 className="w-3 h-3 text-zinc-500" />
            <span>Auditoria Centralizada</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
