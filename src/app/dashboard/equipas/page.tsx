'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users2,
  Plus,
  Truck,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Save,
  Radio,
} from 'lucide-react'
import { EquipaCorporativa } from '@/types/ocorrencia'

export default function EquipasPage() {
  const [equipas, setEquipas] = useState<EquipaCorporativa[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal de Adicionar / Editar Equipa
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [formNome, setFormNome] = useState('')
  const [formLider, setFormLider] = useState('')
  const [formViatura, setFormViatura] = useState('')
  const [formContacto, setFormContacto] = useState('')
  const [formZona, setFormZona] = useState('')
  const [formMembros, setFormMembros] = useState(4)
  const [formTipos, setFormTipos] = useState<string[]>(['secundaria', 'residencial'])
  const [salvando, setSalvando] = useState(false)

  const carregarEquipas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/equipas')
      const json = await res.json()
      if (res.ok && json.data) {
        setEquipas(json.data)
      } else {
        throw new Error(json.error || 'Falha ao carregar lista de equipas.')
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
      void carregarEquipas()
    }, 0)
    return () => clearTimeout(timer)
  }, [carregarEquipas])

  const abrirModalNovo = () => {
    setEditandoId(null)
    setFormNome('')
    setFormLider('')
    setFormViatura('Toyota Hilux 4x4 (MP-00-00)')
    setFormContacto('+258 84 900 0000 (VHF 05)')
    setFormZona('Maputo e Matola')
    setFormMembros(4)
    setFormTipos(['secundaria', 'residencial'])
    setModalOpen(true)
  }

  const abrirModalEditar = (eq: EquipaCorporativa) => {
    setEditandoId(eq.id)
    setFormNome(eq.nome)
    setFormLider(eq.lider)
    setFormViatura(eq.viatura)
    setFormContacto(eq.contacto)
    setFormZona(eq.zona_cobertura)
    setFormMembros(eq.membros_ativos)
    setFormTipos(eq.tipos_infraestrutura)
    setModalOpen(true)
  }

  const handleSalvarEquipa = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (editandoId) {
        const res = await fetch('/api/equipas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editandoId,
            nome: formNome,
            lider: formLider,
            viatura: formViatura,
            contacto: formContacto,
            zona_cobertura: formZona,
            membros_ativos: Number(formMembros),
            tipos_infraestrutura: formTipos,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao atualizar equipa.')
        setSuccessMsg(`Equipa '${formNome}' atualizada com sucesso.`)
      } else {
        const res = await fetch('/api/equipas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formNome,
            lider: formLider,
            viatura: formViatura,
            contacto: formContacto,
            zona_cobertura: formZona,
            membros_ativos: Number(formMembros),
            tipos_infraestrutura: formTipos,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao registar equipa.')
        setSuccessMsg(`Nova equipa '${formNome}' registada no cadastro operacional.`)
      }

      setModalOpen(false)
      await carregarEquipas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtiva = async (eq: EquipaCorporativa) => {
    try {
      const res = await fetch('/api/equipas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eq.id, ativa: !eq.ativa }),
      })
      if (!res.ok) throw new Error('Erro ao alterar status da equipa.')
      await carregarEquipas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    }
  }

  const handleRemover = async (id: string) => {
    if (!confirm('Deseja realmente remover esta equipa do cadastro operacional?')) return
    try {
      const res = await fetch(`/api/equipas?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover equipa.')
      setSuccessMsg('Equipa removida do registo operacional.')
      await carregarEquipas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER DO MÓDULO ESTILO C# TOOLSTRIP */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-700 text-white p-1 corporate-card">
              <Users2 className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              Gestão de Equipas de Campo & Piquetes de Intervenção
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Cadastro de viaturas, líderes de brigada e especialidades de rede para despacho operacional SAAS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarEquipas}
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
            <span>Registar Nova Equipa</span>
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

      {/* TABELA CORPORATIVA DE EQUIPAS (WINDOWS FORMS DATAGRIDVIEW) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 corporate-card overflow-hidden shadow-xs">
        <div className="bg-zinc-100 dark:bg-zinc-800/80 px-3 py-2 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
          <span>REGISTO DE BRIGADAS OPERACIONAIS ({equipas.length} UNIDADES)</span>
          <span>ESTADO EM TEMPO REAL</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 font-mono uppercase">
                <th className="p-3">Equipa & Especialidade</th>
                <th className="p-3">Líder de Piquete</th>
                <th className="p-3">Viatura & Rádio</th>
                <th className="p-3">Área de Cobertura</th>
                <th className="p-3 text-center">Efetivo</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
              {equipas.map((eq) => (
                <tr
                  key={eq.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{eq.nome}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {eq.tipos_infraestrutura.map((tipo) => (
                        <span
                          key={tipo}
                          className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.2 text-[9px] font-mono corporate-badge uppercase"
                        >
                          {tipo}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">{eq.lider}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Brigada Operacional</span>
                  </td>
                  <td className="p-3 text-[11px]">
                    <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                      <Truck className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span>{eq.viatura}</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500 font-mono mt-0.5">
                      <Radio className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{eq.contacto}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{eq.zona_cobertura}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold corporate-badge">
                      {eq.membros_ativos} Op.
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleAtiva(eq)}
                      className={`corporate-badge px-2 py-0.5 text-[10px] font-bold uppercase ${
                        eq.ativa
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-zinc-200 text-zinc-700 border-zinc-400 hover:bg-zinc-300'
                      }`}
                      title="Clique para alternar entre operacional e fora de serviço"
                    >
                      {eq.ativa ? 'Operacional' : 'Indisponível'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirModalEditar(eq)}
                        className="p-1 text-zinc-600 hover:text-blue-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 corporate-card border border-zinc-300 dark:border-zinc-700"
                        title="Editar parâmetros da equipa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemover(eq.id)}
                        className="p-1 text-zinc-600 hover:text-rose-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 corporate-card border border-zinc-300 dark:border-zinc-700"
                        title="Remover equipa do sistema"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOG FORM MODAL (WINDOWS FORMS MODAL DIALOG) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border-2 border-blue-800 corporate-card max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="font-bold font-mono text-xs uppercase text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Users2 className="w-4 h-4 text-blue-700" />
                {editandoId ? 'Editar Parâmetros da Brigada' : 'Registo de Nova Brigada Operacional'}
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEquipa} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Designação Oficial da Equipa:
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Equipa Epsilon - Piquete Machava"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Líder de Brigada:
                  </label>
                  <input
                    type="text"
                    required
                    value={formLider}
                    onChange={(e) => setFormLider(e.target.value)}
                    placeholder="Ex: Eng. Américo Sitoe"
                    className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Efetivo (Operadores):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={formMembros}
                    onChange={(e) => setFormMembros(Number(e.target.value))}
                    className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Viatura Operacional:
                  </label>
                  <input
                    type="text"
                    required
                    value={formViatura}
                    onChange={(e) => setFormViatura(e.target.value)}
                    placeholder="Ex: Toyota Hilux 4x4 (MP-14-88)"
                    className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Contacto / Canal VHF:
                  </label>
                  <input
                    type="text"
                    required
                    value={formContacto}
                    onChange={(e) => setFormContacto(e.target.value)}
                    placeholder="Ex: +258 84 900 1101 (VHF 04)"
                    className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Zona de Cobertura Geográfica:
                </label>
                <input
                  type="text"
                  required
                  value={formZona}
                  onChange={(e) => setFormZona(e.target.value)}
                  placeholder="Ex: Bairros Chamanculo, Malhangalene e Zimpeto"
                  className="corporate-input w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
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
                  <span>{salvando ? 'A Gravar...' : 'Gravar Registo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
