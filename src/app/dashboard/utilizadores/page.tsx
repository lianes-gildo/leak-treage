'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Plus,
  Mail,
  Phone,
  CheckCircle2,
  RefreshCw,
  Edit2,
  X,
  Save,
  User,
  Shield,
} from 'lucide-react'
import { UsuarioCorporativo, PapelUsuario } from '@/types/ocorrencia'

export default function UtilizadoresPage() {
  const [utilizadores, setUtilizadores] = useState<UsuarioCorporativo[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [formNome, setFormNome] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPapel, setFormPapel] = useState<PapelUsuario>('operador')
  const [formDepartamento, setFormDepartamento] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregarUtilizadores = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/utilizadores')
      const json = await res.json()
      if (res.ok && json.data) {
        setUtilizadores(json.data)
      } else {
        throw new Error(json.error || 'Erro ao carregar lista de utilizadores.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarUtilizadores()
    }, 0)
    return () => clearTimeout(timer)
  }, [carregarUtilizadores])

  const abrirModalNovo = () => {
    setEditandoId(null)
    setFormNome('')
    setFormEmail('')
    setFormPapel('operador')
    setFormDepartamento('Mesa de Triagem Operacional Maputo')
    setFormTelefone('+258 84 311 0000')
    setModalOpen(true)
  }

  const abrirModalEditar = (u: UsuarioCorporativo) => {
    setEditandoId(u.id)
    setFormNome(u.nome)
    setFormEmail(u.email)
    setFormPapel(u.papel)
    setFormDepartamento(u.departamento)
    setFormTelefone(u.telefone)
    setModalOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (editandoId) {
        const res = await fetch('/api/utilizadores', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editandoId,
            nome: formNome,
            email: formEmail,
            papel: formPapel,
            departamento: formDepartamento,
            telefone: formTelefone,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao atualizar dados.')
        setSuccessMsg(`Perfil de ${formNome} atualizado com sucesso.`)
      } else {
        const res = await fetch('/api/utilizadores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formNome,
            email: formEmail,
            papel: formPapel,
            departamento: formDepartamento,
            telefone: formTelefone,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao registar utilizador.')
        setSuccessMsg(`Novo utilizador ${formNome} registado no diretório corporativo SAAS.`)
      }

      setModalOpen(false)
      await carregarUtilizadores()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (u: UsuarioCorporativo) => {
    try {
      const res = await fetch('/api/utilizadores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, ativo: !u.ativo }),
      })
      if (!res.ok) throw new Error('Falha ao alterar estado da conta.')
      await carregarUtilizadores()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    }
  }

  const getBadgeRole = (papel: PapelUsuario) => {
    switch (papel) {
      case 'admin':
        return 'bg-purple-800 text-white'
      case 'supervisor':
        return 'bg-blue-800 text-white'
      case 'engenheiro':
        return 'bg-emerald-800 text-white'
      case 'operador':
        return 'bg-zinc-800 text-white'
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER DO MÓDULO */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-700 text-white p-1 corporate-card">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              Gestão de Utilizadores Corporativos & Controlo de Acesso (RBAC)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Gestão de credenciais, permissões hierárquicas e auditoria de operadores da rede SAAS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarUtilizadores}
            disabled={loading}
            className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={abrirModalNovo}
            className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Operador</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-3 corporate-card text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-3 corporate-card text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TABELA DE UTILIZADORES */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card overflow-hidden shadow-xs">
        <div className="bg-zinc-100 dark:bg-zinc-800/80 px-3 py-2 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
          <span>DIRETÓRIO INSTITUCIONAL DE OPERADORES ({utilizadores.length} CONTAS)</span>
          <span>NÍVEL DE PERMISSÃO ATIVO</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 font-mono uppercase">
                <th className="p-3">Operador & Departamento</th>
                <th className="p-3">Função (Role RBAC)</th>
                <th className="p-3">Contactos Oficiais</th>
                <th className="p-3">Último Acesso (CAT)</th>
                <th className="p-3 text-center">Estado da Conta</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
              {utilizadores.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{u.nome}</div>
                    <div className="text-[11px] text-zinc-500">{u.departamento}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`${getBadgeRole(u.papel)} px-2 py-0.5 text-[10px] font-mono font-bold corporate-badge uppercase flex items-center gap-1 w-fit`}
                    >
                      <Shield className="w-3 h-3" />
                      <span>{u.papel}</span>
                    </span>
                  </td>
                  <td className="p-3 text-[11px]">
                    <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-mono">
                      <Mail className="w-3 h-3 text-zinc-400" />
                      <span>{u.email}</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-zinc-400" />
                      <span>{u.telefone}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[11px] text-zinc-500 font-mono">
                    {u.ultimo_acesso
                      ? new Date(u.ultimo_acesso).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' })
                      : 'Sem registo recente'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleAtivo(u)}
                      className={`corporate-badge px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.ativo
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      {u.ativo ? 'Autorizado' : 'Suspenso'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => abrirModalEditar(u)}
                      className="p-1 text-zinc-600 hover:text-blue-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 corporate-card border border-zinc-300 dark:border-zinc-700"
                      title="Editar cargo ou dados do operador"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DIALOG */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border-2 border-blue-800 corporate-card max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="font-bold font-mono text-xs uppercase text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-700" />
                {editandoId ? 'Editar Perfil de Operador' : 'Registar Novo Operador SAAS'}
              </span>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Nome Completo:</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Dra. Fátima Nhaca"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  E-mail Institucional:
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ex: supervisor@saas.co.mz"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Função / Papel RBAC:
                </label>
                <select
                  value={formPapel}
                  onChange={(e) => setFormPapel(e.target.value as PapelUsuario)}
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold"
                >
                  <option value="operador">Operador (Triagem & Despacho)</option>
                  <option value="supervisor">Supervisor (Validação & SLA Crítico)</option>
                  <option value="engenheiro">Engenheiro Hidráulico (GIS & Redes)</option>
                  <option value="admin">Administrador Geral de TI</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Departamento:</label>
                <input
                  type="text"
                  required
                  value={formDepartamento}
                  onChange={(e) => setFormDepartamento(e.target.value)}
                  placeholder="Ex: Centro de Controlo Operacional (CCO)"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Telefone / Rádio:</label>
                <input
                  type="text"
                  required
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="Ex: +258 84 311 0002"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 px-3 py-1.5 font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{salvando ? 'A Gravar...' : 'Gravar Alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
