export type Prioridade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

export type StatusOcorrencia = 'pendente' | 'em_validacao' | 'validado' | 'em_progresso' | 'resolvido' | 'rejeitado'

export type TipoImovel = 'residencia' | 'comercio' | 'edificio_publico'

export type LocalFuga =
  | 'dentro_residencia'
  | 'passeio'
  | 'estrada'
  | 'terreno'
  | 'caixa_agua'
  | 'conduta'
  | 'outro'

export type IntensidadeReportada = 'gotas' | 'pequeno_fluxo' | 'fluxo_forte' | 'jacto'

export type AfetaOutros =
  | 'nao'
  | 'uma_residencia'
  | 'varias_residencias'
  | 'rua_zona'
  | 'nao_sei'

export interface Cliente {
  id: string
  nome: string | null
  tipo_imovel: TipoImovel | null
  endereco: string | null
  criado_em: string
}

export interface ClassificacaoGemini {
  is_leak: boolean
  confidence: number // 0 a 1
  leak_type: string
  estimated_pipe_diameter_mm: number | null
  water_flow: 'nenhum' | 'gotas' | 'pequeno_fluxo' | 'fluxo_continuo' | 'grande_fluxo' | 'jacto'
  affected_area: string
  infrastructure_type: string
  visible_damage: boolean
  risk_to_people: 'nenhum' | 'baixo' | 'medio' | 'alto' | 'critico'
  risk_to_property: 'nenhum' | 'baixo' | 'medio' | 'alto' | 'critico'
  reason: string
}

export interface PriorityInput {
  infraestrutura: 1 | 2 | 3 | 4 | 5
  diametro: 1 | 2 | 3 | 4 | 5
  caudal: 1 | 2 | 3 | 4 | 5
  impacto: 1 | 2 | 3 | 4 | 5
  risco: 1 | 2 | 3 | 4 | 5
  confidence: number
}

export interface PriorityOutput {
  score: number
  prioridade: Prioridade
  necessita_validacao_humana: boolean
  motivo: string
}

// --- FASE 2 TYPES ---

export type FonteDado = 'gis' | 'gemini'

export interface FontesDadosMap {
  infraestrutura: FonteDado
  diametro: FonteDado
  caudal: FonteDado
  impacto: FonteDado
  risco: FonteDado
}

export type TipoInfraestruturaGIS = 'residencial' | 'secundaria' | 'principal' | 'reservatorio' | 'outro'

export interface ContextoRede {
  id: string
  nome_ativo: string
  tipo_infraestrutura: TipoInfraestruturaGIS
  diametro_mm: number
  latitude: number
  longitude: number
  clientes_estimados: number
  pressao_estimada_bar: number | null
  distancia_metros: number
}

export interface GrupoOcorrencia {
  id: string
  prioridade_consolidada: Prioridade
  quantidade_reportes: number
  raio_metros: number
  criado_em: string
  atualizado_em: string
}

export type AcaoDespacho = 'fila_automatica' | 'fila_validacao_humana' | 'fila_urgente_humana'

export interface DispatchDecision {
  acao: AcaoDespacho
  motivo: string
}

export interface FeedbackValidacao {
  id: string
  ocorrencia_id: string
  prioridade_sugerida: Prioridade
  prioridade_confirmada: Prioridade
  concordou: boolean
  fontes_dados: FontesDadosMap | null
  validado_por: string | null
  criado_em: string
}

// --- FASE 3 TYPES & RBAC CORPORATIVO ---

export type PapelUsuario = 'operador' | 'supervisor' | 'admin' | 'engenheiro'

export interface Perfil {
  id: string
  nome: string
  papel: PapelUsuario
  equipa: string | null
  criado_em: string
}

export interface UsuarioCorporativo {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
  departamento: string
  telefone: string
  ativo: boolean
  criado_em: string
  ultimo_acesso?: string
}

export interface Equipa {
  id: string
  nome: string
  tipos_infraestrutura: string[]
  ativa: boolean
  criado_em: string
}

export interface EquipaCorporativa {
  id: string
  nome: string
  lider: string
  viatura: string
  contacto: string
  zona_cobertura: string
  tipos_infraestrutura: string[]
  membros_ativos: number
  ativa: boolean
  criado_em: string
}

export interface ConfiguracaoPrioridade {
  prioridade: Prioridade
  nome: string
  sla_horas: number
  descricao: string
  tipo_despacho: string
  criterios: string[]
  cor_badge: string
}

export type TipoEventoAuditoria =
  | 'classificacao_inicial'
  | 'escalonamento_sla'
  | 'amplificacao_grupo'
  | 'correcao_manual'
  | 'atribuicao_equipa'
  | 'mudanca_status'

export interface AuditoriaOcorrencia {
  id: string
  ocorrencia_id: string
  tipo_evento: TipoEventoAuditoria
  valor_anterior: unknown
  valor_novo: unknown
  motivo: string
  autor: string
  criado_em: string
}

// --- FASE 4 TYPES ---

export type TipoNotificacao = 'nova_urgente' | 'escalonada' | 'grupo_amplificado' | 'atribuicao_pendente'

export interface Notificacao {
  id: string
  destinatario_id: string | null
  papel_alvo: PapelUsuario | null
  ocorrencia_id: string | null
  grupo_id: string | null
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  lida: boolean
  criado_em: string
}

export interface Ocorrencia {
  id: string
  cliente_id: string | null
  foto_url: string
  latitude: number | null
  longitude: number | null
  local_fuga: LocalFuga | null
  agua_saindo_agora: boolean | null
  intensidade_reportada: IntensidadeReportada | null
  afeta_outros: AfetaOutros | null
  classificacao_gemini: ClassificacaoGemini | null
  prioridade: Prioridade | null
  priority_score: number | null
  confidence: number | null
  status: StatusOcorrencia
  validado_por: string | null
  criado_em: string
  atualizado_em: string
  cliente?: Cliente | null

  // Colunas da Fase 2
  grupo_id?: string | null
  sla_limite?: string | null
  escalonada?: boolean
  prioridade_original?: Prioridade | null
  fontes_dados?: FontesDadosMap | null
  decisao_despacho?: DispatchDecision | null
  grupo?: GrupoOcorrencia | null

  // Colunas da Fase 3
  contacto_cliente?: string | null
  equipa_atribuida?: string | null
  atribuido_em?: string | null
  atribuido_por?: string | null
  motivo_rejeicao?: string | null
  observacoes_cliente?: string | null
  tipo_pavimento?: string | null
  risco_acidente?: boolean | null
  foto_expirada?: boolean
  foto_purgada_em?: string | null

  // Colunas de Integração Externa (Mapa de Distribuição)
  enviado_mapa_externo?: boolean
  enviado_mapa_em?: string | null
  hash_integracao?: string | null
  motivo_descarte?: string | null
}

// --- TIPOS DE INTEGRAÇÃO EXTERNA (MAPA DE DISTRIBUIÇÃO) ---

export interface GeoJSONGeometryPoint {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface GeoJSONFeatureProperties {
  id: string
  protocolo: string
  prioridade: Prioridade | null
  priority_score: number | null
  confidence: number | null
  status: StatusOcorrencia
  local_fuga: LocalFuga | null
  agua_saindo_agora: boolean | null
  intensidade_reportada: IntensidadeReportada | null
  afeta_outros: AfetaOutros | null
  tipo_infraestrutura: string | null
  diametro_mm: number | null
  caudal: string | null
  foto_url: string
  validado_por: string | null
  criado_em: string
  validado_em: string | null
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometryPoint
  properties: GeoJSONFeatureProperties
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  metadata: {
    total: number
    gerado_em: string
    origem: string
  }
}

export interface EventoIntegracaoMapa {
  event_id: string
  event_type: 'ocorrencia.validada' | 'ocorrencia.descartada' | 'ocorrencia.atualizada'
  timestamp: string
  ocorrencia: GeoJSONFeatureProperties & {
    coordenadas: {
      latitude: number | null
      longitude: number | null
    }
  }
}
