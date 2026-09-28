'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  SlidersHorizontal,
  ExternalLink,
  LogOut,
  Building2,
  Radio,
  Clock,
  Server,
  User,
  CheckCircle2,
  Menu,
  X,
  Bell,
  Wifi,
  RefreshCw,
} from 'lucide-react'
import { UsuarioCorporativo } from '@/types/ocorrencia'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioCorporativo | null>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Estado de Comunicação com o Sistema do Mapa Externo (Ponto Verde / Vermelho)
  const [commStatus, setCommStatus] = useState<{
    conectado: boolean
    latenciaMs: number
    mensagem: string
    verificadoEm: string
    modo: string
    urlDestino: string | null
  }>({
    conectado: true,
    latenciaMs: 1,
    mensagem: 'Canal ativo',
    verificadoEm: '',
    modo: 'api_polling',
    urlDestino: null,
  })
  const [testingComm, setTestingComm] = useState(false)
  const [showCommModal, setShowCommModal] = useState(false)

  const handleTestPing = async () => {
    setTestingComm(true)
    try {
      const res = await fetch('/api/v1/integracao/status', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCommStatus(data)
      }
    } catch {
      setCommStatus((prev) => ({
        ...prev,
        conectado: false,
        mensagem: 'Falha ao executar teste ativo de conexão.',
      }))
    } finally {
      setTestingComm(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const runCheck = async () => {
      try {
        const res = await fetch('/api/v1/integracao/status')
        if (res.ok && isMounted) {
          const data = await res.json()
          setCommStatus(data)
        }
      } catch {
        if (isMounted) {
          setCommStatus((prev) => ({
            ...prev,
            conectado: false,
            mensagem: 'Falha ao consultar estado da comunicação.',
          }))
        }
      }
    }

    const timer = setInterval(runCheck, 15000)
    const initialTimer = setTimeout(runCheck, 0)

    return () => {
      isMounted = false
      clearTimeout(initialTimer)
      clearInterval(timer)
    }
  }, [])

  // Quando o operador seleciona outro menu na sidebar, repõe o scroll no topo do workspace
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [pathname])

  // Atualiza relógio no padrão Moçambique CAT (UTC+2)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('pt-MZ', {
          timeZone: 'Africa/Maputo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Carrega operador autenticado
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.usuario) {
          setUsuario(data.usuario)
        }
      })
      .catch((err) => console.error('Erro ao verificar sessão:', err))
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Erro ao sair:', err)
      router.push('/login')
    }
  }

  const menuItems = [
    {
      label: 'Fila de Triagem Operacional',
      sublabel: 'Validação, envio ao mapa ou descarte',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
    },
    {
      label: 'Alertas & Notificações',
      sublabel: 'Ocorrências críticas e limites de SLA',
      href: '/dashboard/notificacoes',
      icon: Bell,
      active: pathname === '/dashboard/notificacoes',
    },
    {
      label: 'Matriz de Prioridades & SLAs',
      sublabel: 'Políticas P1–P5 e regras de despacho',
      href: '/dashboard/prioridades',
      icon: SlidersHorizontal,
      active: pathname === '/dashboard/prioridades',
    },
  ]

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden flex flex-col bg-zinc-200 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 select-none">
      {/* 1. TOP TITLE STRIP (WINDOWS FORMS MENU/TITLE BAR) - ESTRITAMENTE FIXO */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between text-xs shrink-0 select-none shadow-2xs z-30">
        <div className="flex items-center gap-2">
          {/* Botão para abrir sidebar no mobile */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-1 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 corporate-card"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Building2 className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight font-mono uppercase text-zinc-950 dark:text-white">
              SAAS
            </span>
            <span className="text-zinc-400">|</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-bold hidden sm:inline">
              Águas, Salubridade e Saneamento (Maputo) — Triagem Operacional de Fugas
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          {/* INDICADOR DE COMUNICAÇÃO COM O MAPA (PONTO VERDE / VERMELHO) */}
          <button
            onClick={() => setShowCommModal(true)}
            className={`flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono font-bold corporate-card transition-colors cursor-pointer ${
              commStatus.conectado
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
            }`}
            title="Clique para inspecionar estado da comunicação com o sistema do Mapa"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                commStatus.conectado
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
              }`}
            />
            <span className="hidden sm:inline font-bold">
              MAPA: {commStatus.conectado ? 'COMUNICANDO' : 'DESCONECTADO'}
            </span>
            <span className="sm:hidden font-bold">
              {commStatus.conectado ? 'ON' : 'OFF'}
            </span>
          </button>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

          <div className="hidden sm:flex items-center gap-1.5 text-zinc-400">
            <Radio className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold text-zinc-300">Maputo CCO</span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

          <div className="flex items-center gap-1 text-blue-800 dark:text-blue-300 font-bold">
            <Clock className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>{currentTime || '00:00:00'}</span>
            <span className="text-[9px] text-zinc-500">CAT</span>
          </div>

          {usuario && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 corporate-card">
                <User className="w-3 h-3 text-blue-700" />
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[10px]">
                  {usuario.nome.split(' ')[0]}
                </span>
                <span className="text-[9px] uppercase px-1 py-0 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-mono font-bold">
                  {usuario.papel}
                </span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 2. CORPO PRINCIPAL COM SIDEBAR CORPORATIVA FIXA */}
      <div className="flex-1 flex min-h-0 w-full relative overflow-hidden">
        {/* SIDEBAR CORPORATIVA ESTILO C# WINDOWS FORMS - DOCK LATERAL FIXO */}
        <aside
          className={`${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 transition-transform duration-150 ease-in-out fixed md:static inset-y-0 left-0 z-40 w-64 h-full min-h-0 bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 flex flex-col justify-between shrink-0 shadow-sm`}
        >
          {/* PAINEL SUPERIOR DO OPERADOR NA SIDEBAR - FIXO */}
          <div className="p-3 border-b border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shrink-0">
            <div className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider mb-1">
              Sessão Autenticada (RBAC)
            </div>
            {usuario ? (
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {usuario.nome}
                </div>
                <div className="text-[10px] text-zinc-500 truncate font-mono">
                  {usuario.email}
                </div>
                <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium truncate">
                  {usuario.departamento}
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono">A carregar operador...</div>
            )}
          </div>

          {/* LISTA DE MÓDULOS DE NAVEGAÇÃO CORPORATIVA */}
          <nav className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto corporate-scrollbar">
            <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-500 font-mono tracking-wider">
              Módulos do Sistema
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-2 text-xs font-medium corporate-btn transition-none text-left border ${
                    item.active
                      ? 'bg-blue-700 text-white border-blue-800 shadow-2xs font-bold'
                      : 'bg-white dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${item.active ? 'text-white' : 'text-blue-700 dark:text-blue-400'}`} />
                  <div className="overflow-hidden">
                    <span className="block truncate">{item.label}</span>
                    <span className={`block text-[10px] truncate ${item.active ? 'text-blue-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {item.sublabel}
                    </span>
                  </div>
                </Link>
              )
            })}

            <div className="pt-3 px-2 py-1 text-[10px] font-bold uppercase text-zinc-500 font-mono tracking-wider">
              Canais Externos
            </div>

            <Link
              href="/reportar"
              target="_blank"
              className="w-full flex items-center justify-between px-2.5 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 corporate-btn"
              title="Abre o canal público do cidadão numa nova aba"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Portal Cidadão</span>
              </span>
              <span className="text-[9px] font-mono bg-emerald-100 text-emerald-900 border border-emerald-300 px-1 corporate-badge">
                PÚBLICO
              </span>
            </Link>

            <Link
              href="/api/v1/integracao/mapa"
              target="_blank"
              className="w-full flex items-center justify-between px-2.5 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 corporate-btn"
              title="Abre o feed de integração segura para o Mapa de Distribuição"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Feed do Mapa (GIS)</span>
              </span>
              <span className="text-[9px] font-mono bg-blue-100 text-blue-900 border border-blue-300 px-1 corporate-badge">
                GEOJSON
              </span>
            </Link>
          </nav>

          {/* RODAPÉ DA SIDEBAR: TERMINAR SESSÃO - FIXO */}
          <div className="p-2 border-t border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shrink-0">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="corporate-btn w-full bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 text-xs font-bold py-2 px-3 flex items-center justify-center gap-2 disabled:opacity-50"
              title="Encerra com segurança a sessão corporativa no dispositivo"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'A Encerrar...' : 'Terminar Sessão'}</span>
            </button>
          </div>
        </aside>

        {/* OVERLAY MOBILE QUANDO SIDEBAR ABERTA */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}

        {/* 3. WORKSPACE PRINCIPAL (ÚNICA ÁREA DE SCROLL DO SISTEMA) */}
        <main
          ref={mainRef}
          className="flex-1 min-h-0 h-full overflow-y-auto overscroll-contain corporate-scrollbar p-3 sm:p-4 md:p-5 select-text"
        >
          <div className="w-full max-w-7xl mx-auto space-y-4 pb-10">
            {children}
          </div>
        </main>
      </div>

      {/* 4. STATUSSTRIP INFERIOR (WINDOWS FORMS STATUSSTRIP) - ESTRITAMENTE FIXO */}
      <footer className="bg-zinc-300 dark:bg-zinc-900 border-t border-zinc-400 dark:border-zinc-800 px-3 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          <span className="text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>NÓ OPERACIONAL ATIVO</span>
          </span>
          <span>|</span>
          <span>SAAS — ÁGUAS, SALUBRIDADE E SANEAMENTO (MAPUTO)</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <Server className="w-3 h-3" />
          <span>SAAS-MAPUTO-PROD-01</span>
        </div>
      </footer>

      {/* MODAL DE DIAGNÓSTICO DE COMUNICAÇÃO COM O MAPA */}
      {showCommModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowCommModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 corporate-card max-w-md w-full p-4 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Wifi className={`w-4 h-4 ${commStatus.conectado ? 'text-emerald-500' : 'text-rose-500'}`} />
                <span className="text-xs font-bold font-mono uppercase text-zinc-900 dark:text-zinc-100">
                  Canal de Integração — Mapa de Distribuição
                </span>
              </div>
              <button
                onClick={() => setShowCommModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div
                className={`p-3 border corporate-card flex items-start gap-3 ${
                  commStatus.conectado
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 ${
                    commStatus.conectado
                      ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse'
                      : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]'
                  }`}
                />
                <div className="space-y-1">
                  <div className="font-bold font-mono text-sm">
                    {commStatus.conectado ? 'SISTEMA COMUNICANDO (ATIVO)' : 'SISTEMA DESCONECTADO (OFFLINE)'}
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {commStatus.mensagem}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-2.5 corporate-card space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Modo de Operação:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {commStatus.modo === 'webhook_ativo'
                      ? 'Webhook Push (Tempo Real)'
                      : 'API Pull (GeoJSON sob Demanda)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Latência do Canal:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {commStatus.latenciaMs} ms
                  </span>
                </div>
                {commStatus.urlDestino ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Endpoint Destino:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                      {commStatus.urlDestino}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block">URL de Consumo (Sistema do Mapa):</span>
                    <div className="flex items-center gap-1.5 bg-zinc-200 dark:bg-zinc-900 p-1 corporate-card text-[10px] break-all">
                      <code className="text-blue-700 dark:text-blue-300 select-all flex-1">
                        /api/v1/integracao/mapa?api_key=saas_sec_mapa_dev_key_2026
                      </code>
                      <a
                        href="/api/v1/integracao/mapa?api_key=saas_sec_mapa_dev_key_2026"
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 p-1 shrink-0"
                        title="Abrir GeoJSON no navegador"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Última Verificação:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {commStatus.verificadoEm
                      ? new Date(commStatus.verificadoEm).toLocaleTimeString('pt-MZ')
                      : 'Agora'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={handleTestPing}
                disabled={testingComm}
                className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingComm ? 'animate-spin' : ''}`} />
                <span>{testingComm ? 'A Testar Handshake...' : 'Testar Conexão Agora'}</span>
              </button>

              <button
                onClick={() => setShowCommModal(false)}
                className="corporate-btn bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs px-3 py-1.5 font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
