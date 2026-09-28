'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  Building2,
  ExternalLink,
  Radio,
  KeyRound,
} from 'lucide-react'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  const [email, setEmail] = useState('supervisor@saas.co.mz')
  const [senha, setSenha] = useState('********')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleLogin = async (overrideEmail?: string, overrideRole?: string) => {
    setLoading(true)
    setErro(null)

    try {
      const emailFinal = overrideEmail || email
      const roleFinal = overrideRole || undefined

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailFinal, role: roleFinal, senha }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Credenciais inválidas ou conta suspensa.')
      }

      // Redireciona para o destino administrativo pretendido
      router.push(redirectPath)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden flex flex-col bg-zinc-200 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 select-none">
      {/* WINDOWS FORMS TITLE STRIP - FIXO NO TOPO */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none shadow-2xs z-30">
        <div className="flex items-center gap-2">
          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight font-mono uppercase">
            SAAS — Águas, Salubridade e Saneamento (Maputo)
          </span>
          <span className="text-zinc-400">|</span>
          <span className="font-mono text-zinc-600 dark:text-zinc-400">Consola de Acesso Restrito</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
            <Radio className="w-3 h-3" />
            <span>PORTAL SEGURO</span>
          </span>
          <span>|</span>
          <span>CAT UTC+2</span>
        </div>
      </header>

      {/* ÁREA CENTRAL / DIALOG FORM - ÚNICA ÁREA DE SCROLL */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain corporate-scrollbar p-4 flex items-center justify-center select-text">
        <div className="max-w-md mx-auto w-full my-auto py-6">
          <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 corporate-card p-6 shadow-md space-y-5">
          {/* HEADER DO FORMULÁRIO ESTILO C# WINFORMS */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 text-center">
            <div className="w-12 h-12 bg-blue-700 text-white flex items-center justify-center mx-auto mb-2 corporate-card">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-base font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
              Autenticação de Operador
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Sistema Central de Triagem e Despacho de Fugas (Moçambique)
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-3 corporate-card text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-red-600" />
              <span>{erro}</span>
            </div>
          )}

          {/* FORMULÁRIO DE LOGIN */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                E-mail Institucional SAAS:
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@saas.co.mz"
                  className="corporate-input w-full pl-8 p-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Chave de Acesso / Senha:
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-3" />
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="corporate-input w-full pl-8 p-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="corporate-btn w-full bg-blue-700 hover:bg-blue-800 text-white font-bold p-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50 tracking-wider uppercase mt-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>{loading ? 'A Validar Credenciais...' : 'Entrar no Sistema'}</span>
            </button>
          </form>

          {/* ACESSO RÁPIDO OPERACIONAL PARA ENSAIOS E DEMONSTRAÇÃO */}
          <div className="win-groupbox pt-2">
            <legend className="text-[10px] uppercase font-bold text-zinc-500 font-mono">
              Seletor Rápido de Perfil (Ensaios Corporativos)
            </legend>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleLogin('supervisor@saas.co.mz', 'supervisor')}
                disabled={loading}
                className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-left p-2 text-[11px] border border-zinc-300 dark:border-zinc-700 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-blue-800 dark:text-blue-300 block">
                    Dra. Fátima Nhaca (Supervisora CCO)
                  </span>
                  <span className="text-[10px] text-zinc-500">Acesso Total a Despacho, SLA & Métricas</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleLogin('operador@saas.co.mz', 'operador')}
                disabled={loading}
                className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-left p-2 text-[11px] border border-zinc-300 dark:border-zinc-700 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                    Sr. Tomás Cossa (Operador de Triagem)
                  </span>
                  <span className="text-[10px] text-zinc-500">Validação e Atribuição de Equipas de Piquete</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleLogin('admin@saas.co.mz', 'admin')}
                disabled={loading}
                className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-left p-2 text-[11px] border border-zinc-300 dark:border-zinc-700 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-purple-800 dark:text-purple-300 block">
                    Eng. Arnaldo Mabunda (Administrador)
                  </span>
                  <span className="text-[10px] text-zinc-500">Gestão de Utilizadores, RBAC & Auditoria Geral</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px]">
            <Link
              href="/reportar"
              className="text-blue-700 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>Canal Público Cidadão</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-zinc-400 font-mono text-[10px]">SAAS RBAC v2.4</span>
          </div>
        </div>
        </div>
      </main>

      {/* FOOTER STATUSSTRIP - FIXO NA BASE */}
      <footer className="bg-zinc-300 dark:bg-zinc-900 border-t border-zinc-400 dark:border-zinc-800 px-4 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between font-mono shrink-0 select-none z-30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>SESSÃO ENCRIPTADA COM POLÍTICA DE SEGURANÇA NACIONAL</span>
        </div>
        <span>REPÚBLICA DE MOÇAMBIQUE</span>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-200 flex items-center justify-center p-4">
          <div className="p-4 bg-white border border-zinc-400 corporate-card text-xs font-mono">
            A inicializar módulo de segurança SAAS...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
