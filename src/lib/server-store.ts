import {
  Ocorrencia,
  Notificacao,
  Prioridade,
  ContextoRede,
  AuditoriaOcorrencia,
  FeedbackValidacao,
  UsuarioCorporativo,
  EquipaCorporativa,
  ConfiguracaoPrioridade,
} from '@/types/ocorrencia'

/**
 * Store em memória resiliente para garantir disponibilidade contínua do sistema
 * caso a instância Supabase remota esteja pausada por inatividade ou com falha temporária de DNS.
 */
class ServerStore {
  private ocorrencias: Ocorrencia[] = []
  private notificacoes: Notificacao[] = []

  public removerOcorrencia(id: string): boolean {
    const idx = this.ocorrencias.findIndex((o) => o.id === id || o.id.startsWith(id))
    if (idx < 0) return false
    this.ocorrencias.splice(idx, 1)
    this.notificacoes = this.notificacoes.filter((n) => n.ocorrencia_id !== id)
    return true
  }

  public limparOcorrencias(): void {
    this.ocorrencias = []
    this.notificacoes = []
    this.auditorias = []
    this.feedbacks = []
  }

  /**
   * Política de Retenção & Privacidade de Dados Pesados (Máximo 48 Horas):
   * Purga fotografias em base64 e dados pesados de ocorrências com mais de 48h de vida,
   * preservando metadados estruturais, histórico de auditoria e coordenadas geográficas.
   */
  public purgarDadosPesadosExpirados(): { expurgadas: number; bytesLiberados: number } {
    const LIMITE_RETENCAO_MS = 48 * 60 * 60 * 1000 // 48 horas
    const agora = Date.now()
    let expurgadas = 0
    let bytesLiberados = 0

    for (const oc of this.ocorrencias) {
      const dataCriacao = new Date(oc.criado_em).getTime()
      if (agora - dataCriacao > LIMITE_RETENCAO_MS) {
        if (!oc.foto_expirada) {
          if (oc.foto_url && oc.foto_url.length > 300) {
            bytesLiberados += oc.foto_url.length
            oc.foto_url = 'retencao_expirada_48h'
          }
          oc.foto_expirada = true
          oc.foto_purgada_em = new Date().toISOString()
          expurgadas++
        }
      }
    }

    return { expurgadas, bytesLiberados }
  }

  public listarOcorrencias(): Ocorrencia[] {
    this.purgarDadosPesadosExpirados()
    return [...this.ocorrencias].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
    )
  }

  public buscarOcorrenciaPorId(id: string): Ocorrencia | null {
    this.purgarDadosPesadosExpirados()
    return this.ocorrencias.find((o) => o.id === id || o.id.startsWith(id)) || null
  }

  public salvarOcorrencia(nova: Ocorrencia): Ocorrencia {
    const idx = this.ocorrencias.findIndex((o) => o.id === nova.id)
    if (idx >= 0) {
      this.ocorrencias[idx] = { ...this.ocorrencias[idx], ...nova, atualizado_em: new Date().toISOString() }
      return this.ocorrencias[idx]
    } else {
      this.ocorrencias.unshift(nova)
      return nova
    }
  }

  public atualizarOcorrencia(id: string, campos: Partial<Ocorrencia>): Ocorrencia | null {
    const idx = this.ocorrencias.findIndex((o) => o.id === id || o.id.startsWith(id))
    if (idx < 0) return null
    this.ocorrencias[idx] = {
      ...this.ocorrencias[idx],
      ...campos,
      atualizado_em: new Date().toISOString(),
    }
    return this.ocorrencias[idx]
  }

  public listarNotificacoes(): Notificacao[] {
    return [...this.notificacoes].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
    )
  }

  public adicionarNotificacao(notif: Omit<Notificacao, 'id' | 'criado_em'>): Notificacao {
    const nova: Notificacao = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      criado_em: new Date().toISOString(),
    }
    this.notificacoes.unshift(nova)
    return nova
  }

  public marcarNotificacaoLida(id: string): boolean {
    const notif = this.notificacoes.find((n) => n.id === id)
    if (notif) {
      notif.lida = true
      return true
    }
    return false
  }

  public marcarTodasNotificacoesLidas(): number {
    let count = 0
    for (const n of this.notificacoes) {
      if (!n.lida) {
        n.lida = true
        count++
      }
    }
    return count
  }

  public escalonarSLAVencidos(): { escalonadas: number; logs: string[] } {
    this.purgarDadosPesadosExpirados()
    const agora = new Date()
    const logs: string[] = []
    let escalonadas = 0

    for (const oc of this.ocorrencias) {
      if (oc.status === 'resolvido' || oc.escalonada || !oc.sla_limite) continue
      if (new Date(oc.sla_limite) <= agora) {
        const prioAtual = oc.prioridade || 'P3'
        if (prioAtual === 'P1') {
          logs.push(`Ocorrência ${oc.id.substring(0, 8)} [P1] no topo da prioridade.`)
          continue
        }

        let novaPrio: Prioridade = 'P1'
        if (prioAtual === 'P5') novaPrio = 'P4'
        else if (prioAtual === 'P4') novaPrio = 'P3'
        else if (prioAtual === 'P3') novaPrio = 'P2'

        oc.prioridade_original = oc.prioridade_original || prioAtual
        oc.prioridade = novaPrio
        oc.escalonada = true
        oc.atualizado_em = agora.toISOString()
        escalonadas++

        const logMsg = `Ocorrência ${oc.id.substring(0, 8)}: SLA vencido. Escalonada de ${prioAtual} para ${novaPrio}.`
        logs.push(logMsg)

        this.adicionarNotificacao({
          destinatario_id: null,
          papel_alvo: 'supervisor',
          ocorrencia_id: oc.id,
          grupo_id: oc.grupo_id || null,
          tipo: 'escalonada',
          titulo: `Alerta de SLA Vencido [${novaPrio}]`,
          mensagem: logMsg,
          lida: false,
        })
      }
    }

    return { escalonadas, logs }
  }

  // --- CIRCUIT BREAKER PARA SUPABASE ---
  private supabaseOnline: boolean = false
  private lastSupabaseAttempt: number = 0
  private readonly CIRCUIT_WINDOW_MS = 60000 // 60 segundos antes de retentar

  public canAttemptSupabase(): boolean {
    if (this.supabaseOnline) return true
    return Date.now() - this.lastSupabaseAttempt > this.CIRCUIT_WINDOW_MS
  }

  public recordSupabaseFailure(): void {
    this.supabaseOnline = false
    this.lastSupabaseAttempt = Date.now()
  }

  public recordSupabaseSuccess(): void {
    this.supabaseOnline = true
    this.lastSupabaseAttempt = Date.now()
  }

  public isSupabaseUp(): boolean {
    return this.supabaseOnline
  }

  // --- CADASTRO GIS RESILIENTE ---
  private redeCadastro: ContextoRede[] = [
    {
      id: 'ativo-001',
      nome_ativo: 'Conduta Adutora Baixa de Maputo DN300',
      tipo_infraestrutura: 'principal',
      diametro_mm: 300,
      latitude: -25.9692,
      longitude: 32.5732,
      clientes_estimados: 1200,
      pressao_estimada_bar: 4.8,
      distancia_metros: 0,
    },
    {
      id: 'ativo-002',
      nome_ativo: 'Ramal Distribuição Sommerschield / Polana DN50',
      tipo_infraestrutura: 'secundaria',
      diametro_mm: 50,
      latitude: -25.9535,
      longitude: 32.5880,
      clientes_estimados: 60,
      pressao_estimada_bar: 3.2,
      distancia_metros: 0,
    },
    {
      id: 'ativo-003',
      nome_ativo: 'Subadutora Matola Centro DN150',
      tipo_infraestrutura: 'secundaria',
      diametro_mm: 150,
      latitude: -25.9622,
      longitude: 32.4589,
      clientes_estimados: 450,
      pressao_estimada_bar: 4.0,
      distancia_metros: 0,
    },
    {
      id: 'ativo-004',
      nome_ativo: 'Ramal Doméstico Chamanculo DN25',
      tipo_infraestrutura: 'residencial',
      diametro_mm: 25,
      latitude: -25.9450,
      longitude: 32.5550,
      clientes_estimados: 12,
      pressao_estimada_bar: 2.8,
      distancia_metros: 0,
    },
    {
      id: 'ativo-005',
      nome_ativo: 'Conduta Distribuição Beira Centro DN100',
      tipo_infraestrutura: 'secundaria',
      diametro_mm: 100,
      latitude: -19.8325,
      longitude: 34.8389,
      clientes_estimados: 85,
      pressao_estimada_bar: 3.5,
      distancia_metros: 0,
    },
  ]

  public listarAtivosRede(): ContextoRede[] {
    return [...this.redeCadastro]
  }

  public buscarAtivoProximo(lat: number, lon: number, raioMetros = 30): ContextoRede | null {
    let maisProximo: ContextoRede | null = null
    let menorDist = Infinity

    for (const ativo of this.redeCadastro) {
      const R = 6371e3
      const rad = Math.PI / 180
      const dLat = (ativo.latitude - lat) * rad
      const dLon = (ativo.longitude - lon) * rad
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * rad) * Math.cos(ativo.latitude * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const dist = R * c

      if (dist <= raioMetros && dist < menorDist) {
        menorDist = dist
        maisProximo = { ...ativo, distancia_metros: Math.round(dist * 10) / 10 }
      }
    }

    return maisProximo
  }

  // --- TRILHA DE AUDITORIA RESILIENTE ---
  private auditorias: AuditoriaOcorrencia[] = []

  public adicionarAuditoria(evento: Omit<AuditoriaOcorrencia, 'id' | 'criado_em'>): AuditoriaOcorrencia {
    const reg: AuditoriaOcorrencia = {
      ...evento,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      criado_em: new Date().toISOString(),
    }
    this.auditorias.unshift(reg)
    return reg
  }

  public listarAuditorias(ocorrenciaId?: string): AuditoriaOcorrencia[] {
    if (ocorrenciaId) {
      return this.auditorias.filter((a) => a.ocorrencia_id === ocorrenciaId)
    }
    return [...this.auditorias]
  }

  // --- FEEDBACK DE VALIDAÇÃO RESILIENTE ---
  private feedbacks: FeedbackValidacao[] = []

  public adicionarFeedback(fb: Omit<FeedbackValidacao, 'id' | 'criado_em'>): FeedbackValidacao {
    const novo: FeedbackValidacao = {
      ...fb,
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      criado_em: new Date().toISOString(),
    }
    this.feedbacks.unshift(novo)
    return novo
  }

  public listarFeedbacks(inicio?: Date, fim?: Date): FeedbackValidacao[] {
    if (!inicio && !fim) return [...this.feedbacks]
    return this.feedbacks.filter((f) => {
      const d = new Date(f.criado_em)
      if (inicio && d < inicio) return false
      if (fim && d > fim) return false
      return true
    })
  }

  // --- GESTÃO CORPORATIVA DE EQUIPAS ---
  private equipas: EquipaCorporativa[] = [
    {
      id: 'eq-001',
      nome: 'Equipa Alpha - Redes Secundárias e Ramais (Maputo)',
      lider: 'Eng. Américo Sitoe',
      viatura: 'Toyota Hilux 4x4 (MP-14-88)',
      contacto: '+258 84 900 1101 (Canal Rádio VHF 04)',
      zona_cobertura: 'Maputo Cidade (Baixa, Polana, Sommerschield, Malhangalene)',
      tipos_infraestrutura: ['secundaria', 'residencial', 'passeio'],
      membros_ativos: 4,
      ativa: true,
      criado_em: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'eq-002',
      nome: 'Equipa Beta - Grandes Condutas Adutoras (SAAS Maputo)',
      lider: 'Eng. Belmiro Macuácua',
      viatura: 'Camião Oficina Isuzu FVR (MP-89-22)',
      contacto: '+258 84 900 1102 (Canal Rádio VHF 01 - Emergências)',
      zona_cobertura: 'Grande Maputo & Corredor da Matola',
      tipos_infraestrutura: ['principal', 'conduta_principal', 'reservatorio', 'adutora'],
      membros_ativos: 6,
      ativa: true,
      criado_em: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'eq-003',
      nome: 'Equipa Gamma - Piquete Rápido de Intervenção P1',
      lider: 'Técnico Zacarias Mondlane',
      viatura: 'Nissan Hardbody Piquete (MP-45-77)',
      contacto: '+258 84 900 1103 (Canal Rádio VHF 02)',
      zona_cobertura: 'Zimpeto, Chamanculo, Maxaquene e Aeroporto',
      tipos_infraestrutura: ['principal', 'secundaria', 'estrada', 'via_publica'],
      membros_ativos: 3,
      ativa: true,
      criado_em: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'eq-004',
      nome: 'Equipa Delta - Deteção Acústica e Fugas Não Visíveis',
      lider: 'Engª. Celeste Manhique',
      viatura: 'Furgão Laboratório Geofone (MP-02-33)',
      contacto: '+258 84 900 1104 (Canal Rádio VHF 03)',
      zona_cobertura: 'Rede Central e Bairros Históricos de Maputo',
      tipos_infraestrutura: ['secundaria', 'residencial', 'ramal'],
      membros_ativos: 2,
      ativa: true,
      criado_em: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  public listarEquipas(): EquipaCorporativa[] {
    return [...this.equipas]
  }

  public adicionarEquipa(equipa: Omit<EquipaCorporativa, 'id' | 'criado_em'>): EquipaCorporativa {
    const nova: EquipaCorporativa = {
      ...equipa,
      id: `eq-${Date.now().toString().slice(-4)}`,
      criado_em: new Date().toISOString(),
    }
    this.equipas.unshift(nova)
    return nova
  }

  public atualizarEquipa(id: string, dados: Partial<EquipaCorporativa>): EquipaCorporativa | null {
    const idx = this.equipas.findIndex((e) => e.id === id)
    if (idx < 0) return null
    this.equipas[idx] = { ...this.equipas[idx], ...dados }
    return this.equipas[idx]
  }

  public removerEquipa(id: string): boolean {
    const idx = this.equipas.findIndex((e) => e.id === id)
    if (idx < 0) return false
    this.equipas.splice(idx, 1)
    return true
  }

  // --- GESTÃO CORPORATIVA DE UTILIZADORES & RBAC ---
  private utilizadores: UsuarioCorporativo[] = [
    {
      id: 'usr-001',
      nome: 'Eng. Arnaldo Mabunda',
      email: 'admin@saas.co.mz',
      papel: 'admin',
      departamento: 'Direção Geral de Engenharia & TI',
      telefone: '+258 84 311 0001',
      ativo: true,
      criado_em: '2026-01-01T08:00:00Z',
      ultimo_acesso: new Date().toISOString(),
    },
    {
      id: 'usr-002',
      nome: 'Dra. Fátima Nhaca',
      email: 'supervisor@saas.co.mz',
      papel: 'supervisor',
      departamento: 'Centro de Operações de Maputo (CCO)',
      telefone: '+258 84 311 0002',
      ativo: true,
      criado_em: '2026-01-15T08:00:00Z',
      ultimo_acesso: new Date().toISOString(),
    },
    {
      id: 'usr-003',
      nome: 'Sr. Tomás Cossa',
      email: 'operador@saas.co.mz',
      papel: 'operador',
      departamento: 'Mesa de Triagem e Despacho de Piquetes',
      telefone: '+258 84 311 0003',
      ativo: true,
      criado_em: '2026-02-01T08:00:00Z',
      ultimo_acesso: new Date().toISOString(),
    },
    {
      id: 'usr-004',
      nome: 'Eng. Rui Tembe',
      email: 'engenheiro@saas.co.mz',
      papel: 'engenheiro',
      departamento: 'Gabinete de Modelação Hidráulica & GIS',
      telefone: '+258 84 311 0004',
      ativo: true,
      criado_em: '2026-02-10T08:00:00Z',
      ultimo_acesso: new Date().toISOString(),
    },
  ]

  public listarUtilizadores(): UsuarioCorporativo[] {
    return [...this.utilizadores]
  }

  public adicionarUtilizador(user: Omit<UsuarioCorporativo, 'id' | 'criado_em'>): UsuarioCorporativo {
    const novo: UsuarioCorporativo = {
      ...user,
      id: `usr-${Date.now().toString().slice(-4)}`,
      criado_em: new Date().toISOString(),
      ultimo_acesso: new Date().toISOString(),
    }
    this.utilizadores.push(novo)
    return novo
  }

  public atualizarUtilizador(id: string, dados: Partial<UsuarioCorporativo>): UsuarioCorporativo | null {
    const idx = this.utilizadores.findIndex((u) => u.id === id)
    if (idx < 0) return null
    this.utilizadores[idx] = { ...this.utilizadores[idx], ...dados }
    return this.utilizadores[idx]
  }

  public buscarUtilizadorPorEmail(email: string): UsuarioCorporativo | null {
    return this.utilizadores.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null
  }

  public buscarUtilizadorPorId(id: string): UsuarioCorporativo | null {
    return this.utilizadores.find((u) => u.id === id) || null
  }

  // --- GESTÃO DE SESSÕES AUTENTICADAS ---
  private sessoes: Map<string, { usuario: UsuarioCorporativo; expira_em: number }> = new Map([
    [
      'sessao-supervisor-default',
      {
        usuario: {
          id: 'usr-002',
          nome: 'Dra. Fátima Nhaca',
          email: 'supervisor@saas.co.mz',
          papel: 'supervisor',
          departamento: 'Centro de Operações de Maputo (CCO)',
          telefone: '+258 84 311 0002',
          ativo: true,
          criado_em: '2026-01-15T08:00:00Z',
          ultimo_acesso: new Date().toISOString(),
        },
        expira_em: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    ],
  ])

  public criarSessao(usuario: UsuarioCorporativo): string {
    const token = `saas_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    this.sessoes.set(token, {
      usuario,
      expira_em: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
    return token
  }

  public validarSessao(token: string): UsuarioCorporativo | null {
    if (!token) return null
    const sessao = this.sessoes.get(token)
    if (!sessao) return null
    if (Date.now() > sessao.expira_em) {
      this.sessoes.delete(token)
      return null
    }
    return sessao.usuario
  }

  public destruirSessao(token: string): boolean {
    return this.sessoes.delete(token)
  }

  // --- MATRIZ CORPORATIVA DE PRIORIDADES & SLA ---
  private matrizPrioridades: ConfiguracaoPrioridade[] = [
    {
      prioridade: 'P1',
      nome: 'Emergência Crítica / Ruptura de Adutora',
      sla_horas: 0,
      descricao: 'Intervenção imediata com mobilização do Piquete Central. Alerta geral com notificação SMS/Rádio.',
      tipo_despacho: 'Fila Urgente Humana (Supervisor & Operador)',
      criterios: [
        'Risco crítico a pessoas ou património (risco = 5)',
        'Conduta adutora de grande porte com jacto sob pressão (infra = 5, caudal >= 4)',
        'Agrupamento amplificado >= 10 reportes no raio',
      ],
      cor_badge: 'bg-red-700 text-white',
    },
    {
      prioridade: 'P2',
      nome: 'Prioridade Alta / Conduta Secundária',
      sla_horas: 2,
      descricao: 'Despacho prioritário para conter desperdício massivo e despressurização de rede.',
      tipo_despacho: 'Fila Urgente Humana (Operador)',
      criterios: [
        'Grande fluxo contínuo em via pública de tráfego intenso',
        'Infiltração com risco a fundações de edifícios',
        'Escalonamento automático decorrente de P3 vencido',
      ],
      cor_badge: 'bg-orange-700 text-white',
    },
    {
      prioridade: 'P3',
      nome: 'Prioridade Média / Fuga em Passeio ou Valeta',
      sla_horas: 8,
      descricao: 'Intervenção no mesmo turno operacional com verificação de diâmetro no cadastro GIS.',
      tipo_despacho: 'Fila de Validação Humana Supervisionada',
      criterios: [
        'Fluxo forte ou contínuo em passeio pedonal ou valeta',
        'Afeta residências vizinhas ou entrada de garagens',
        'Score do motor determinístico entre 40 e 69 pontos',
      ],
      cor_badge: 'bg-amber-600 text-white',
    },
    {
      prioridade: 'P4',
      nome: 'Prioridade Baixa / Ramal Doméstico Externo',
      sla_horas: 24,
      descricao: 'Planeamento no itinerário diário de manutenção da equipa do setor.',
      tipo_despacho: 'Fila Automática (se confiança >= 0.85) ou Validação',
      criterios: [
        'Pequeno fluxo sem alagamento estrutural',
        'Vazamento na proximidade de válvula de corte',
        'Score determinístico entre 20 e 39 pontos',
      ],
      cor_badge: 'bg-zinc-600 text-white',
    },
    {
      prioridade: 'P5',
      nome: 'Prioridade Mínima / Gotejamento ou Torneira',
      sla_horas: 48,
      descricao: 'Visita de vistoria técnica sem mobilização de equipamento pesado de abertura de vala.',
      tipo_despacho: 'Fila Automática de Agendamento',
      criterios: [
        'Gotas lentas em contador ou ligação privada',
        'Nenhum risco a pessoas, tráfego ou infraestrutura pública',
        'Score determinístico < 20 pontos',
      ],
      cor_badge: 'bg-zinc-800 text-white',
    },
  ]

  public listarMatrizPrioridades(): ConfiguracaoPrioridade[] {
    return [...this.matrizPrioridades]
  }

  public atualizarMatrizPrioridade(
    prio: Prioridade,
    dados: Partial<ConfiguracaoPrioridade>
  ): ConfiguracaoPrioridade | null {
    const idx = this.matrizPrioridades.findIndex((m) => m.prioridade === prio)
    if (idx < 0) return null
    this.matrizPrioridades[idx] = { ...this.matrizPrioridades[idx], ...dados }
    return this.matrizPrioridades[idx]
  }
}

// Instância Singleton no servidor Node
export const serverStore = new ServerStore()
