'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Droplets,
  Camera,
  MapPin,
  Send,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Search,
  Upload,
  Image as ImageIcon,
  ShieldCheck,
  Clock,
  Maximize2,
  X,
  ExternalLink,
  Check,
  Archive,
  Phone,
} from 'lucide-react'
import Link from 'next/link'

interface StatusProtocolo {
  protocolo: string
  id: string
  status: string
  prioridade: string | null
  motivo_rejeicao?: string | null
  foto_url?: string | null
  foto_expirada?: boolean
  local_fuga?: string | null
  intensidade_reportada?: string | null
  agua_saindo_agora?: boolean | null
  afeta_outros?: string | null
  tipo_pavimento?: string | null
  risco_acidente?: boolean | null
  observacoes_cliente?: string | null
  equipa_atribuida?: string | null
  sla_limite?: string | null
  criado_em: string
  atualizado_em: string
}

export default function ReportarPage() {
  const [activeTab, setActiveTab] = useState<'reportar' | 'consultar'>('reportar')

  // Estado do formulário de reporte
  const [fotoUrl, setFotoUrl] = useState('')
  const [fotoNome, setFotoNome] = useState<string | null>(null)
  const [fotoTamanhoBytes, setFotoTamanhoBytes] = useState<number>(500 * 1024)
  const [latitude, setLatitude] = useState<number | null>(-25.9692)
  const [longitude, setLongitude] = useState<number | null>(32.5732)
  const [localFuga, setLocalFuga] = useState('passeio')
  const [aguaSaindoAgora, setAguaSaindoAgora] = useState(true)
  const [intensidade, setIntensidade] = useState('fluxo_forte')
  const [afetaOutros, setAfetaOutros] = useState('uma_residencia')
  const [tipoPavimento, setTipoPavimento] = useState('asfalto')
  const [riscoAcidente, setRiscoAcidente] = useState(false)
  const [observacoesCliente, setObservacoesCliente] = useState('')
  const [contacto, setContacto] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [protocoloSuccess, setProtocoloSuccess] = useState<string | null>(null)
  const [obtendoGPS, setObtendoGPS] = useState(false)
  const [gpsFeedback, setGpsFeedback] = useState<{ tipo: 'sucesso' | 'aviso'; texto: string } | null>(null)

  // Estado da consulta de protocolo
  const [buscaProtocolo, setBuscaProtocolo] = useState('')
  const [loadingBusca, setLoadingBusca] = useState(false)
  const [resultadoBusca, setResultadoBusca] = useState<StatusProtocolo | null>(null)
  const [erroBusca, setErroBusca] = useState<string | null>(null)
  const [modalFotoUrl, setModalFotoUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Repõe o scroll no topo do formulário quando o cidadão alterna entre abas ou submete com sucesso
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [activeTab, protocoloSuccess])

  // Manipulador de upload de ficheiro local / câmara
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecione um ficheiro de imagem válido (JPG, PNG ou WebP).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('A imagem selecionada ultrapassa o limite máximo de 10MB.')
      return
    }

    setFotoNome(file.name)
    setFotoTamanhoBytes(file.size)
    setErrorMsg(null)

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setFotoUrl(result)
    }
    reader.readAsDataURL(file)
  }

  // Captura geolocalização do navegador com suporte a contextos HTTP locais
  const handleObterLocalizacao = () => {
    setGpsFeedback(null)

    // Detecta se estamos num contexto HTTP não encriptado (ex: IP 172.20.10.3)
    const isLocalIPInsecure =
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'

    if (isLocalIPInsecure) {
      setLatitude(-25.9692)
      setLongitude(32.5732)
      setGpsFeedback({
        tipo: 'aviso',
        texto: 'Navegador bloqueia sensor GPS em HTTP não encriptado (IP de rede). Coordenadas padrão da rede atribuídas (Maputo Baixa: -25.9692, 32.5732).',
      })
      return
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setObtendoGPS(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setObtendoGPS(false)
          const lat = Math.round(pos.coords.latitude * 1000000) / 1000000
          const lon = Math.round(pos.coords.longitude * 1000000) / 1000000
          setLatitude(lat)
          setLongitude(lon)
          setGpsFeedback({
            tipo: 'sucesso',
            texto: `GPS obtido com sucesso: ${lat}, ${lon}`,
          })
        },
        (err) => {
          setObtendoGPS(false)
          let explicacao = err.message
          if (err.code === 1) {
            explicacao = 'Permissão de localização recusada pelo utilizador ou bloqueada pelo navegador.'
          } else if (err.code === 2) {
            explicacao = 'Sinal de GPS indisponível no dispositivo.'
          } else if (err.code === 3) {
            explicacao = 'Tempo limite de resposta do sensor GPS excedido.'
          }
          setLatitude(-25.9692)
          setLongitude(32.5732)
          setGpsFeedback({
            tipo: 'aviso',
            texto: `${explicacao} Coordenadas padrão da rede atribuídas (Maputo Baixa).`,
          })
        },
        {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 300000,
        }
      )
    } else {
      setLatitude(-25.9692)
      setLongitude(32.5732)
      setGpsFeedback({
        tipo: 'aviso',
        texto: 'Geolocalização não suportada neste navegador. Coordenadas padrão atribuídas (Maputo Baixa).',
      })
    }
  }

  const handleDefinirCoordenadas = (lat: number, lon: number, nome: string) => {
    setLatitude(lat)
    setLongitude(lon)
    setGpsFeedback({
      tipo: 'sucesso',
      texto: `Coordenadas fixadas para ${nome}: ${lat}, ${lon}`,
    })
  }

  // Define uma imagem de amostra para testes rápidos
  const handleUsarAmostra = (tipo: 'conduta' | 'passeio' | 'gotas' | 'irrelevante') => {
    let url = ''
    if (tipo === 'conduta') {
      url = 'https://images.unsplash.com/photo-1542013936693-884638332954?w=600&auto=format&fit=crop&q=80'
      setFotoNome('amostra_conduta_principal.jpg')
      setLocalFuga('conduta')
      setIntensidade('jacto')
      setAfetaOutros('rua_zona')
    } else if (tipo === 'passeio') {
      url = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80'
      setFotoNome('amostra_passeio_fluxo.jpg')
      setLocalFuga('passeio')
      setIntensidade('fluxo_forte')
      setAfetaOutros('uma_residencia')
    } else if (tipo === 'gotas') {
      url = 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600&auto=format&fit=crop&q=80'
      setFotoNome('amostra_contador_gotas.jpg')
      setLocalFuga('caixa_agua')
      setIntensidade('gotas')
      setAfetaOutros('nao')
    } else {
      url = 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&auto=format&fit=crop&q=80'
      setFotoNome('amostra_sala_sem_agua.jpg')
      setLocalFuga('outro')
      setIntensidade('gotas')
      setAfetaOutros('nao')
    }
    setFotoUrl(url)
    setFotoTamanhoBytes(250 * 1024)
    setErrorMsg(null)
  }

  // Submete a ocorrência
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const urlFinal =
      fotoUrl.trim() ||
      'https://images.unsplash.com/photo-1542013936693-884638332954?w=600&auto=format&fit=crop&q=80'

    if (!contacto.trim()) {
      setErrorMsg('Por favor introduza o seu contacto telefónico ou de e-mail.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foto_url: urlFinal,
          tamanho_bytes: fotoTamanhoBytes,
          latitude,
          longitude,
          local_fuga: localFuga,
          agua_saindo_agora: aguaSaindoAgora,
          intensidade_reportada: intensidade,
          afeta_outros: afetaOutros,
          tipo_pavimento: tipoPavimento,
          risco_acidente: riscoAcidente,
          observacoes_cliente: observacoesCliente.trim() || null,
          contacto_cliente: contacto.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Falha ao submeter ocorrência no servidor')
      }

      setProtocoloSuccess(json.protocolo)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Erro na submissão:', msg)
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  // Consulta ocorrência por protocolo
  const handleConsultarProtocolo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buscaProtocolo.trim()) return

    setLoadingBusca(true)
    setErroBusca(null)
    setResultadoBusca(null)

    try {
      const res = await fetch(`/api/ocorrencias?protocolo=${encodeURIComponent(buscaProtocolo.trim())}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Ocorrência não localizada')
      }

      setResultadoBusca(json.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErroBusca(msg)
    } finally {
      setLoadingBusca(false)
    }
  }

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden flex flex-col bg-zinc-200 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none">
      {/* WINDOWS FORMS TITLE STRIP - FIXO NO TOPO */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none shadow-2xs z-30">
        <div className="flex items-center gap-2">
          <div className="bg-blue-700 text-white p-1 corporate-card">
            <Droplets className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono uppercase">
            SAAS
          </span>
          <span className="text-zinc-400">|</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Águas, Salubridade e Saneamento (Maputo) — Portal do Cidadão
          </span>
        </div>

        <Link
          href="/dashboard"
          className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-800 font-bold flex items-center gap-1.5"
          title="Aceder à consola operacional interna com credenciais corporativas"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Consola Interna / Dashboard</span>
        </Link>
      </header>

      {/* ÁREA CENTRAL - ÚNICO CONTENTOR COM SCROLL */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain corporate-scrollbar p-3 sm:p-6 select-text"
      >
        <div className="max-w-3xl mx-auto w-full space-y-4 pb-12">
          {/* SELETOR DE ABAS ESTILO TABCONTROL WINDOWS FORMS */}
          <div className="flex border-b border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 p-1 corporate-card gap-1">
          <button
            onClick={() => setActiveTab('reportar')}
            title="Mudar para o formulário de registo e triagem de nova fuga de água"
            className={`corporate-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'reportar'
                ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 border border-zinc-300 dark:border-zinc-700 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Registar Nova Fuga de Água</span>
          </button>
          <button
            onClick={() => setActiveTab('consultar')}
            title="Mudar para a pesquisa do estado e histórico de uma ocorrência submetida por protocolo"
            className={`corporate-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'consultar'
                ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 border border-zinc-300 dark:border-zinc-700 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Consultar Estado por Protocolo</span>
          </button>
        </div>

        {/* ABA 1: FORMULÁRIO DE REPORTE */}
        {activeTab === 'reportar' && (
          <div>
            {protocoloSuccess ? (
              <div className="bg-white dark:bg-zinc-900 border border-emerald-600 corporate-card p-6 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto corporate-card">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                    Ocorrência Registada com Sucesso no Sistema
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    A sua ocorrência entrou na fila de triagem operacional e foi encaminhada para processamento.
                    Guarde o seu número de protocolo para acompanhamento.
                  </p>
                </div>

                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-4 corporate-card inline-block">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">
                    Número de Protocolo Oficial:
                  </span>
                  <span className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-400">
                    {protocoloSuccess}
                  </span>
                </div>

                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setBuscaProtocolo(protocoloSuccess)
                      setActiveTab('consultar')
                    }}
                    title="Preencher e consultar imediatamente o estado desta ocorrência recém-criada"
                    className="corporate-btn bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-xs px-4 py-2 flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Acompanhar Estado Deste Protocolo</span>
                  </button>
                  <button
                    onClick={() => {
                      setProtocoloSuccess(null)
                      setContacto('')
                      setFotoUrl('')
                      setFotoNome(null)
                    }}
                    title="Limpar formulário e iniciar o registo de outra fuga de água"
                    className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2"
                  >
                    Registar Nova Ocorrência
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-5 sm:p-6 space-y-4 shadow-xs">
                {errorMsg && (
                  <div className="bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-3 corporate-card text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* PAINEL DE APOIO E ORIENTAÇÃO AO CIDADÃO (CARDS ESTRUTURADOS) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div
                    className="p-3 bg-blue-50/80 dark:bg-zinc-800/80 border border-blue-200 dark:border-zinc-700 corporate-card space-y-1 text-xs shadow-2xs"
                    title="Dicas fundamentais para garantir que a inteligência artificial valide a sua ocorrência com máxima precisão"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300 font-mono text-[11px] uppercase">
                      <Camera className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span>1. Foto Clara da Água</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Aponte a câmara diretamente para o ponto de saída da água. Fotografias secas ou sem água visível são rejeitadas pelo sistema.
                    </p>
                  </div>

                  <div
                    className="p-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 corporate-card space-y-1 text-xs shadow-2xs"
                    title="Prazos oficiais estabelecidos pelo SAAS (Águas, Salubridade e Saneamento) por nível de gravidade"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200 font-mono text-[11px] uppercase">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>2. Prazos de Piquete</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Emergência P1 (Adutora): Imediato. Alta P2 (Via Pública): 2h. Média P3 (Passeio): 8h. Baixa P4/P5: 24 a 48h.
                    </p>
                  </div>

                  <div
                    className="p-3 bg-emerald-50/80 dark:bg-zinc-800/80 border border-emerald-200 dark:border-zinc-700 corporate-card space-y-1 text-xs shadow-2xs"
                    title="O seu número telefónico está protegido e é usado estritamente pelo piquete técnico"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300 font-mono text-[11px] uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>3. Sigilo & Proteção</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      O seu número de telemóvel não é público. Serve apenas para envio de protocolo SMS e confirmação de chegada do piquete.
                    </p>
                  </div>
                </div>

                {/* 1. FOTO DA FUGA (UPLOAD REAL / CÂMARA / EXEMPLOS) */}
                <div className="win-groupbox">
                  <legend>1. Imagem da Fuga de Água (Obrigatório)</legend>
                  
                  <div className="space-y-3 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* ÁREA DE SELEÇÃO / DRAG & DROP */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-600 dark:hover:border-blue-400 p-4 text-center cursor-pointer corporate-card bg-zinc-50 dark:bg-zinc-800/50 transition-colors"
                      title="Clique aqui para acionar a câmara fotográfica ou carregar ficheiro de imagem da fuga de água"
                    >
                      {fotoUrl ? (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fotoUrl} alt="Pré-visualização" className="w-full h-full object-cover" />
                          </div>
                          <div className="text-left text-xs">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Imagem Carregada com Sucesso
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-400 block font-mono text-[11px] truncate max-w-xs">
                              {fotoNome || 'ficheiro_imagem.jpg'}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              {(fotoTamanhoBytes / 1024).toFixed(1)} KB — Clique para substituir por outra foto
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 py-2">
                          <Upload className="w-6 h-6 mx-auto text-blue-700 dark:text-blue-400" />
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            Clique para Tirar Foto com a Câmara ou Selecionar do Telemóvel
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Formatos suportados: JPG, PNG, WebP (tamanho máximo de 10MB)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BOTÕES DE AMOSTRA PARA TESTES RÁPIDOS */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-zinc-400" />
                        Amostras Rápidas:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUsarAmostra('conduta')}
                        className="corporate-btn bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold px-2 py-1"
                        title="Carrega fotografia de teste simulando cisalhamento de conduta adutora com jacto sob pressão"
                      >
                        Conduta (Jacto)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUsarAmostra('passeio')}
                        className="corporate-btn bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold px-2 py-1"
                        title="Carrega fotografia de teste simulando fuga contínua na calçada ou passeio pedonal"
                      >
                        Passeio (Fluxo)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUsarAmostra('gotas')}
                        className="corporate-btn bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold px-2 py-1"
                        title="Carrega fotografia de teste simulando gotejamento lento em ligação residencial de contador"
                      >
                        Contador (Gotas)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUsarAmostra('irrelevante')}
                        className="corporate-btn bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-200 dark:border-rose-800 text-[11px] font-semibold px-2 py-1"
                        title="Carrega fotografia de sala seca sem água para verificar a rejeição automática pelo motor de visão computacional"
                      >
                        Seco / Sem Água (Teste Rejeição IA)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. LOCALIZAÇÃO GEOGRÁFICA */}
                <div className="win-groupbox">
                  <legend>2. Localização Geográfica (Coordenadas)</legend>
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 font-mono">LATITUDE:</label>
                          <input
                            type="number"
                            step="any"
                            value={latitude ?? ''}
                            onChange={(e) => setLatitude(parseFloat(e.target.value))}
                            placeholder="-25.9692"
                            className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 font-mono">LONGITUDE:</label>
                          <input
                            type="number"
                            step="any"
                            value={longitude ?? ''}
                            onChange={(e) => setLongitude(parseFloat(e.target.value))}
                            placeholder="32.5732"
                            className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleObterLocalizacao}
                          disabled={obtendoGPS}
                          title="Detecta automaticamente as coordenadas de latitude e longitude utilizando o sensor GPS ou rede do seu dispositivo"
                          className="corporate-btn w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <MapPin className={`w-3.5 h-3.5 ${obtendoGPS ? 'animate-spin' : ''}`} />
                          <span>{obtendoGPS ? 'A obter GPS...' : 'Obter GPS Atual'}</span>
                        </button>
                      </div>
                    </div>

                    {/* FEEDBACK DE GPS */}
                    {gpsFeedback && (
                      <div
                        className={`text-[11px] p-2 corporate-card border font-medium ${
                          gpsFeedback.tipo === 'sucesso'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {gpsFeedback.texto}
                      </div>
                    )}

                    {/* BOTÕES DE COORDENADAS PRÉ-DEFINIDAS */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono">
                        Predefinições Rápidas:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDefinirCoordenadas(-25.9692, 32.5732, 'Maputo Baixa')}
                        title="Preencher coordenadas da Baixa da Cidade de Maputo (-25.9692, 32.5732)"
                        className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono px-2 py-0.5 border border-zinc-300 dark:border-zinc-700"
                      >
                        Maputo (Baixa)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefinirCoordenadas(-25.9622, 32.4589, 'Matola Centro')}
                        title="Preencher coordenadas do Município da Matola (-25.9622, 32.4589)"
                        className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono px-2 py-0.5 border border-zinc-300 dark:border-zinc-700"
                      >
                        Matola (Centro)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefinirCoordenadas(-19.8325, 34.8389, 'Beira Centro')}
                        title="Preencher coordenadas da Cidade da Beira (-19.8325, 34.8389)"
                        className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono px-2 py-0.5 border border-zinc-300 dark:border-zinc-700"
                      >
                        Beira (Centro)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefinirCoordenadas(-15.1165, 39.2666, 'Nampula Centro')}
                        title="Preencher coordenadas da Cidade de Nampula (-15.1165, 39.2666)"
                        className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono px-2 py-0.5 border border-zinc-300 dark:border-zinc-700"
                      >
                        Nampula
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefinirCoordenadas(-25.9653, 32.5892, 'Sede SAAS Maputo')}
                        title="Preencher coordenadas da Sede do SAAS / Bairro da Polana (-25.9653, 32.5892)"
                        className="corporate-btn bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono px-2 py-0.5 border border-zinc-300 dark:border-zinc-700"
                      >
                        Sede SAAS (Polana)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. QUESTIONÁRIO OBJETIVO (4 PERGUNTAS) */}
                <div className="win-groupbox">
                  <legend>3. Questionário Operacional de Triagem</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Onde está a sair a água?
                      </label>
                      <select
                        value={localFuga}
                        onChange={(e) => setLocalFuga(e.target.value)}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="passeio">No Passeio / Calçada</option>
                        <option value="estrada">Na Estrada / Via Pública</option>
                        <option value="conduta">Na Conduta Principal</option>
                        <option value="dentro_residencia">Dentro de Casa / Jardim</option>
                        <option value="caixa_agua">Na Caixa de Contador / Ramal</option>
                        <option value="outro">Outro Local</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Qual a intensidade observada?
                      </label>
                      <select
                        value={intensidade}
                        onChange={(e) => setIntensidade(e.target.value)}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="gotas">Gotas / Pingos Lentos</option>
                        <option value="pequeno_fluxo">Pequeno Fluxo Contínuo</option>
                        <option value="fluxo_forte">Fluxo Forte</option>
                        <option value="jacto">Jacto sob Pressão / Inundação</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        A água continua a sair agora?
                      </label>
                      <select
                        value={aguaSaindoAgora ? 'sim' : 'nao'}
                        onChange={(e) => setAguaSaindoAgora(e.target.value === 'sim')}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="sim">Sim, continua a correr ativamente</option>
                        <option value="nao">Não, já parou de sair</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Afeta a vizinhança ou via pública?
                      </label>
                      <select
                        value={afetaOutros}
                        onChange={(e) => setAfetaOutros(e.target.value)}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="nao">Não, apenas o meu imóvel</option>
                        <option value="uma_residencia">Sim, mais 1 residência</option>
                        <option value="varias_residencias">Sim, várias habitações</option>
                        <option value="rua_zona">Sim, a rua ou zona inteira</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Tipo de Pavimento / Solo:
                      </label>
                      <select
                        value={tipoPavimento}
                        onChange={(e) => setTipoPavimento(e.target.value)}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="asfalto">Asfalto / Faixa de Rodagem</option>
                        <option value="calcada">Calçada / Passeio Pavimentado</option>
                        <option value="terra">Terra Batida</option>
                        <option value="outro">Outro Tipo de Pavimento</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Risco iminente de acidente?
                      </label>
                      <select
                        value={riscoAcidente ? 'sim' : 'nao'}
                        onChange={(e) => setRiscoAcidente(e.target.value === 'sim')}
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="nao">Não — Sem risco imediato a peões ou viaturas</option>
                        <option value="sim">Sim — Risco para trânsito ou transeuntes</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Observações ou Ponto de Referência (Opcional):
                      </label>
                      <textarea
                        rows={2}
                        value={observacoesCliente}
                        onChange={(e) => setObservacoesCliente(e.target.value)}
                        placeholder="Ex: Perto do mercado central, em frente à farmácia, na esquina da avenida..."
                        className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2 text-zinc-900 dark:text-zinc-100 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. CONTACTO DO CIDADÃO */}
                <div className="win-groupbox">
                  <legend>4. Contacto de Acompanhamento (Obrigatório)</legend>
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block">
                      Número de Telefone ou E-mail:
                    </label>
                    <input
                      type="text"
                      required
                      value={contacto}
                      onChange={(e) => setContacto(e.target.value)}
                      placeholder="Ex: +258 84 123 4567 ou cidadao@aguas.co.mz"
                      className="corporate-input w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2.5 text-zinc-900 dark:text-zinc-100"
                    />
                    <p className="text-[10px] text-zinc-500">
                      O seu contacto é protegido e utilizado para controlo de duplicidade e envio de atualizações.
                    </p>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    title="Enviar relatório completo com foto e dados operacionais para despacho imediato da equipa de piquete"
                    className="corporate-btn w-full bg-blue-700 hover:bg-blue-800 text-white font-bold p-3 text-xs flex items-center justify-center gap-2 disabled:opacity-50 tracking-wide"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'A Submeter Ocorrência para Triagem...' : 'Submeter Ocorrência para Despacho'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ABA 2: CONSULTA DE PROTOCOLO */}
        {activeTab === 'consultar' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 corporate-card p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>Consulta de Estado de Ocorrência</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Introduza o número de protocolo atribuído aquando da submissão da fuga.
              </p>
            </div>

            <form onSubmit={handleConsultarProtocolo} className="flex gap-2">
              <input
                type="text"
                value={buscaProtocolo}
                onChange={(e) => setBuscaProtocolo(e.target.value)}
                placeholder="Ex: PROT-A1B2C3D4 ou ID da ocorrência..."
                className="corporate-input flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs p-2.5 text-zinc-900 dark:text-zinc-100 font-mono"
              />
              <button
                type="submit"
                disabled={loadingBusca}
                title="Pesquisar e verificar o estado de despacho e reparação deste número de protocolo"
                className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white font-bold px-4 py-2 text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{loadingBusca ? 'A consultar...' : 'Consultar'}</span>
              </button>
            </form>

            {erroBusca && (
              <div className="bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-3 corporate-card text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{erroBusca}</span>
              </div>
            )}

            {resultadoBusca && (
              <div className="space-y-4">
                {/* 1. HEADER DO PROTOCOLO E STATUS */}
                <div className="border border-zinc-300 dark:border-zinc-700 p-4 corporate-card bg-zinc-50 dark:bg-zinc-800/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider block">
                        Número de Protocolo Oficial
                      </span>
                      <span className="font-mono font-bold text-base sm:text-lg text-blue-700 dark:text-blue-400">
                        {resultadoBusca.protocolo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {resultadoBusca.status === 'rejeitado' ? (
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600 px-3 py-1 corporate-badge font-mono font-bold text-xs flex items-center gap-1.5">
                          <Archive className="w-3.5 h-3.5 text-zinc-500" />
                          <span>ARQUIVADO (SEM ANOMALIA IDENTIFICADA)</span>
                        </span>
                      ) : resultadoBusca.status === 'resolvido' ? (
                        <span className="bg-emerald-700 text-white px-3 py-1 corporate-badge font-mono font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>RESOLVIDO EM CAMPO</span>
                        </span>
                      ) : resultadoBusca.status === 'validado' || resultadoBusca.status === 'em_progresso' ? (
                        <span className="bg-blue-700 text-white px-3 py-1 corporate-badge font-mono font-bold text-xs flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5" />
                          <span>DESPACHADO PARA PIQUETE</span>
                        </span>
                      ) : (
                        <span className="bg-amber-600 text-white px-3 py-1 corporate-badge font-mono font-bold text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>EM ANÁLISE OPERACIONAL</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. LINHA DO TEMPO VISUAL (STEPPER DE ATENDIMENTO) */}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono block mb-2">
                      Progresso e Acompanhamento do Atendimento
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      {/* Passo 1: Registo */}
                      <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 corporate-card border-l-4 border-l-emerald-600 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase font-mono text-zinc-500">1. Submissão</span>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Registo Recebido</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {new Date(resultadoBusca.criado_em).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' })}
                        </div>
                      </div>

                      {/* Passo 2: Inspecção Técnica */}
                      <div className={`p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 corporate-card border-l-4 ${
                        resultadoBusca.status !== 'pendente' ? 'border-l-emerald-600' : 'border-l-amber-500'
                      } space-y-1`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase font-mono text-zinc-500">2. Inspecção</span>
                          {resultadoBusca.status !== 'pendente' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Triagem de Rede</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {resultadoBusca.status !== 'pendente' ? 'Verificação concluída' : 'Aguardando fila'}
                        </div>
                      </div>

                      {/* Passo 3: Despacho / Alocação */}
                      <div className={`p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 corporate-card border-l-4 ${
                        resultadoBusca.status === 'rejeitado'
                          ? 'border-l-zinc-500'
                          : resultadoBusca.status === 'validado' || resultadoBusca.status === 'em_progresso' || resultadoBusca.status === 'resolvido'
                          ? 'border-l-emerald-600'
                          : 'border-l-zinc-300 dark:border-l-zinc-700'
                      } space-y-1`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase font-mono text-zinc-500">3. Despacho</span>
                          {resultadoBusca.status === 'rejeitado' ? (
                            <Archive className="w-3.5 h-3.5 text-zinc-500" />
                          ) : resultadoBusca.status === 'validado' || resultadoBusca.status === 'em_progresso' || resultadoBusca.status === 'resolvido' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {resultadoBusca.status === 'rejeitado' ? 'Processo Arquivado' : 'Alocação Piquete'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          {resultadoBusca.status === 'rejeitado'
                            ? 'Sem envio de meios'
                            : resultadoBusca.equipa_atribuida || 'Em atribuição'}
                        </div>
                      </div>

                      {/* Passo 4: Resolução em Campo */}
                      <div className={`p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 corporate-card border-l-4 ${
                        resultadoBusca.status === 'resolvido'
                          ? 'border-l-emerald-600'
                          : resultadoBusca.status === 'rejeitado'
                          ? 'border-l-zinc-500'
                          : 'border-l-zinc-300 dark:border-l-zinc-700'
                      } space-y-1`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase font-mono text-zinc-500">4. Resolução</span>
                          {resultadoBusca.status === 'resolvido' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : resultadoBusca.status === 'rejeitado' ? (
                            <Check className="w-3.5 h-3.5 text-zinc-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {resultadoBusca.status === 'resolvido'
                            ? 'Reparação Concluída'
                            : resultadoBusca.status === 'rejeitado'
                            ? 'Encerramento'
                            : 'Intervenção no Local'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {resultadoBusca.status === 'resolvido'
                            ? 'Estanqueidade reposta'
                            : resultadoBusca.status === 'rejeitado'
                            ? 'Concluído sem intervenção'
                            : 'A aguardar conclusão'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. MENSAGEM SÓLIDA E INSTITUCIONAL QUANDO SEM FUGA (REJEITADO) */}
                {resultadoBusca.status === 'rejeitado' && (
                  <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-4 corporate-card space-y-3">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                      <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">
                        Comunicação Oficial de Verificação Técnica
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      <p>
                        {resultadoBusca.motivo_rejeicao ||
                          'Após verificação técnica dos elementos fotográficos e documentais, não foram identificados indícios visíveis de rotura, jacto ou fuga de água na infraestrutura pública sob gestão do SAAS. O registo foi arquivado sem mobilização de piquete operacional.'}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Para assegurar a máxima disponibilidade e prontidão das brigadas de piquete para situações emergenciais de perda de água na rede metropolitana, os meios operacionais são reservados exclusivamente para anomalias comprovadas.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <Phone className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span>Piquete 24 Horas: <strong>(+258) 84 311 0000</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('reportar')
                          setBuscaProtocolo('')
                          setResultadoBusca(null)
                        }}
                        className="corporate-btn bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Submeter Novo Reporte com Fotografia Nítida</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. CARD DA FOTOGRAFIA SUBMETIDA COM LIGHTBOX E POLÍTICA DE 48 HORAS */}
                <div className="win-groupbox space-y-2">
                  <legend>Registo Fotográfico Submetido pelo Cidadão</legend>

                  {resultadoBusca.foto_expirada || !resultadoBusca.foto_url ? (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 corporate-card text-xs flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-zinc-900 dark:text-zinc-200 font-mono text-[11px] uppercase">
                           Registo Fotográfico Arquivado (Política de Retenção de 48 Horas)
                        </span>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          Conforme a política de privacidade e gestão de armazenamento do SAAS, as imagens originais enviadas pelos cidadãos são expurgadas dos servidores após 48 horas da submissão. O número de protocolo, coordenadas geográficas, parecer técnico e histórico de despacho permanecem arquivados e inalterados para fins de auditoria e garantia do serviço.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <div
                        onClick={() => setModalFotoUrl(resultadoBusca.foto_url!)}
                        className="w-full sm:w-44 h-32 bg-zinc-950 border border-zinc-700 corporate-card overflow-hidden cursor-pointer relative group shrink-0"
                        title="Clique para visualizar fotografia em alta resolução"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resultadoBusca.foto_url}
                          alt="Foto submetida pelo munícipe"
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1542013936693-884638332954?w=600&auto=format&fit=crop&q=80'
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Ampliar</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Fotografia autenticada no momento da submissão</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          Esta imagem serviu de base para a localização e inspeção técnica da ocorrência na rede de abastecimento.
                        </p>
                        <span className="text-[10px] text-zinc-500 font-mono block">
                          Política de Retenção: O ficheiro fotográfico permanecerá disponível para consulta pública por 48 horas a contar da data de registo.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. DADOS TÉCNICOS DECLARADOS PELO MUNÍCIPE */}
                <div className="win-groupbox space-y-2">
                  <legend>Informações Declaradas na Ocorrência</legend>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Local Físico Indicado:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {resultadoBusca.local_fuga === 'conduta'
                          ? 'Via Pública / Rua (Conduta Principal)'
                          : resultadoBusca.local_fuga === 'passeio'
                          ? 'Passeio Público / Valeta'
                          : resultadoBusca.local_fuga === 'dentro_residencia'
                          ? 'Interior da Residência / Quintal'
                          : resultadoBusca.local_fuga === 'caixa_agua'
                          ? 'Caixa do Contador / Ramal'
                          : resultadoBusca.local_fuga || 'Não especificado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Intensidade Observada:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {resultadoBusca.intensidade_reportada === 'jacto'
                          ? 'Jacto forte sob pressão'
                          : resultadoBusca.intensidade_reportada === 'fluxo_forte'
                          ? 'Fluxo contínuo forte'
                          : resultadoBusca.intensidade_reportada === 'gotas'
                          ? 'Gotas / Gotejamento lento'
                          : resultadoBusca.intensidade_reportada || 'Pequeno fluxo'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Água Corrente no Momento:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {resultadoBusca.agua_saindo_agora ? 'Sim — Água corrente contínua' : 'Não — Sem água a correr'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Impacto em Terceiros:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {resultadoBusca.afeta_outros === 'rua_zona'
                          ? 'Toda a rua ou zona afetada'
                          : resultadoBusca.afeta_outros === 'uma_residencia'
                          ? 'Apenas 1 residência'
                          : 'Sem impacto a terceiros'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Tipo de Pavimento:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {resultadoBusca.tipo_pavimento === 'asfalto'
                          ? 'Asfalto / Faixa de Rodagem'
                          : resultadoBusca.tipo_pavimento === 'calcada'
                          ? 'Calçada / Passeio Pavimentado'
                          : resultadoBusca.tipo_pavimento === 'terra'
                          ? 'Terra Batida'
                          : resultadoBusca.tipo_pavimento || 'Outro / Não especificado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Risco de Acidente Declarado:
                      </span>
                      <span className={`font-semibold ${resultadoBusca.risco_acidente ? 'text-red-600 dark:text-red-400 font-bold' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {resultadoBusca.risco_acidente ? 'Sim — Risco para trânsito ou transeuntes' : 'Não reportado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                        Equipa Técnica Responsável:
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {resultadoBusca.equipa_atribuida || (resultadoBusca.status === 'rejeitado' ? 'Sem alocação (Processo arquivado)' : 'Aguardando atribuição na central')}
                      </span>
                    </div>

                    {resultadoBusca.sla_limite && resultadoBusca.status !== 'rejeitado' && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block">
                          Janela Estimada de Resolução (SLA):
                        </span>
                        <span className="font-semibold text-blue-700 dark:text-blue-400 font-mono">
                          {new Date(resultadoBusca.sla_limite).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' })} CAT
                        </span>
                      </div>
                    )}
                  </div>

                  {resultadoBusca.observacoes_cliente && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono block mb-1">
                        Observações ou Ponto de Referência Fornecido:
                      </span>
                      <p className="bg-zinc-100 dark:bg-zinc-950 p-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 corporate-card leading-relaxed">
                        {resultadoBusca.observacoes_cliente}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* MODAL LIGHTBOX DE AMPLIAÇÃO DA FOTO */}
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
                Fotografia da Ocorrência em Alta Resolução
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
                alt="Fotografia da fuga ampliada"
                className="max-h-[72vh] max-w-full object-contain border border-zinc-800"
              />
            </div>
            <div className="w-full text-center text-[11px] text-zinc-500 font-mono py-1">
              Pressione ESC ou clique fora da imagem para fechar
            </div>
          </div>
        </div>
      )}

      {/* FOOTER STATUSSTRIP - FIXO NA BASE */}
      <footer className="bg-zinc-300 dark:bg-zinc-900 border-t border-zinc-400 dark:border-zinc-800 px-4 py-1.5 text-center text-[11px] text-zinc-600 dark:text-zinc-400 font-mono shrink-0 select-none z-30">
        SAAS — ÁGUAS, SALUBRIDADE E SANEAMENTO (MAPUTO) — Atendimento ao Cidadão 24/7
      </footer>
    </div>
  )
}
