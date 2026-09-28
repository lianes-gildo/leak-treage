-- ==============================================================================
-- SAAS FUGA DE ÁGUA - SCRIPT CONSOLIDADO COMPLETO (FASES 1, 2, 3 E 4)
-- Cole este ficheiro diretamente no SQL Editor do seu projeto Supabase e clique "Run".
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA CLIENTES (Fase 1)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  tipo_imovel TEXT CHECK (tipo_imovel IN ('residencia', 'comercio', 'edificio_publico')),
  endereco TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA GRUPOS DE OCORRÊNCIA (Fase 2 - Deduplicação)
CREATE TABLE IF NOT EXISTS public.grupos_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prioridade_consolidada TEXT NOT NULL DEFAULT 'P3',
  quantidade_reportes INT NOT NULL DEFAULT 1,
  raio_metros INT NOT NULL DEFAULT 50,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA PERFIS DE UTILIZADOR (Fase 3 - Papéis)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('operador', 'supervisor', 'admin')),
  equipa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA OCORRÊNCIAS (Fases 1, 2, 3)
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  foto_url TEXT NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  local_fuga TEXT CHECK (local_fuga IN ('dentro_residencia', 'passeio', 'estrada', 'terreno', 'caixa_agua', 'conduta', 'outro')),
  agua_saindo_agora BOOLEAN DEFAULT true,
  intensidade_reportada TEXT CHECK (intensidade_reportada IN ('gotas', 'pequeno_fluxo', 'fluxo_forte', 'jacto')),
  afeta_outros TEXT CHECK (afeta_outros IN ('nao', 'uma_residencia', 'varias_residencias', 'rua_zona', 'nao_sei')),
  classificacao_gemini JSONB,
  prioridade TEXT CHECK (prioridade IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  priority_score NUMERIC(5, 2),
  confidence NUMERIC(3, 2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_validacao', 'validado', 'em_progresso', 'resolvido')),
  validado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Colunas Fase 2
  grupo_id UUID REFERENCES public.grupos_ocorrencia(id) ON DELETE SET NULL,
  sla_limite TIMESTAMPTZ,
  escalonada BOOLEAN DEFAULT false,
  prioridade_original TEXT CHECK (prioridade_original IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  fontes_dados JSONB,
  decisao_despacho JSONB,

  -- Colunas Fase 3
  contacto_cliente TEXT,
  equipa_atribuida TEXT,
  atribuido_em TIMESTAMPTZ,
  atribuido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_prioridade ON public.ocorrencias (prioridade);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON public.ocorrencias (status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_grupo ON public.ocorrencias (grupo_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_contacto ON public.ocorrencias (contacto_cliente);

-- 6. TABELA REDE CADASTRO (Fase 2 - GIS)
CREATE TABLE IF NOT EXISTS public.rede_cadastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_ativo TEXT NOT NULL,
  tipo_infraestrutura TEXT NOT NULL CHECK (tipo_infraestrutura IN ('residencial', 'secundaria', 'principal', 'reservatorio', 'outro')),
  diametro_mm INT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  clientes_estimados INT NOT NULL DEFAULT 1,
  pressao_estimada_bar NUMERIC(4, 2),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rede_cadastro_coords ON public.rede_cadastro (latitude, longitude);

-- 7. TABELA FEEDBACK VALIDAÇÃO (Fase 2 - Métricas)
CREATE TABLE IF NOT EXISTS public.feedback_validacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  prioridade_sugerida TEXT NOT NULL,
  prioridade_confirmada TEXT NOT NULL,
  concordou BOOLEAN NOT NULL,
  fontes_dados JSONB,
  validado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABELA EQUIPAS (Fase 3)
CREATE TABLE IF NOT EXISTS public.equipas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipos_infraestrutura TEXT[] NOT NULL DEFAULT '{}',
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TABELA AUDITORIA OCORRÊNCIA (Fase 3)
CREATE TABLE IF NOT EXISTS public.auditoria_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN (
    'classificacao_inicial',
    'escalonamento_sla',
    'amplificacao_grupo',
    'correcao_manual',
    'atribuicao_equipa',
    'mudanca_status'
  )),
  valor_anterior JSONB,
  valor_novo JSONB,
  motivo TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT 'sistema',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. TABELA NOTIFICAÇÕES (Fase 4)
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE,
  papel_alvo TEXT CHECK (papel_alvo IN ('operador', 'supervisor', 'admin')),
  ocorrencia_id UUID REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos_ocorrencia(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nova_urgente', 'escalonada', 'grupo_amplificado', 'atribuicao_pendente')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_validacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- 12. CONCEDER PERMISSÕES POSTGRES (ROLES ANON E AUTHENTICATED)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 13. POLÍCIAS DE ACESSO (RLS IDEMPOTENTES)
DROP POLICY IF EXISTS "Permitir leitura de clientes a todos" ON public.clientes;
DROP POLICY IF EXISTS "Permitir leitura de clientes a autenticados" ON public.clientes;
CREATE POLICY "Permitir leitura de clientes a todos" ON public.clientes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de grupos a todos" ON public.grupos_ocorrencia;
DROP POLICY IF EXISTS "Permitir operacoes em grupos a todos" ON public.grupos_ocorrencia;
CREATE POLICY "Permitir leitura de grupos a todos" ON public.grupos_ocorrencia FOR SELECT TO public USING (true);
CREATE POLICY "Permitir operacoes em grupos a todos" ON public.grupos_ocorrencia FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de ocorrencias a todos" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir submissao de ocorrencias a todos" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir submissao publica de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir atualizacao de ocorrencias a todos" ON public.ocorrencias;
CREATE POLICY "Permitir leitura de ocorrencias a todos" ON public.ocorrencias FOR SELECT TO public USING (true);
CREATE POLICY "Permitir submissao de ocorrencias a todos" ON public.ocorrencias FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de ocorrencias a todos" ON public.ocorrencias FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de rede_cadastro a todos" ON public.rede_cadastro;
CREATE POLICY "Permitir leitura de rede_cadastro a todos" ON public.rede_cadastro FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir insercao de feedback a todos" ON public.feedback_validacao;
DROP POLICY IF EXISTS "Permitir leitura de feedback a todos" ON public.feedback_validacao;
CREATE POLICY "Permitir insercao de feedback a todos" ON public.feedback_validacao FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir leitura de feedback a todos" ON public.feedback_validacao FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de perfis a todos" ON public.perfis;
CREATE POLICY "Permitir leitura de perfis a todos" ON public.perfis FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de equipas a todos" ON public.equipas;
CREATE POLICY "Permitir leitura de equipas a todos" ON public.equipas FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de auditoria a todos" ON public.auditoria_ocorrencia;
DROP POLICY IF EXISTS "Permitir insercao de auditoria a todos" ON public.auditoria_ocorrencia;
CREATE POLICY "Permitir leitura de auditoria a todos" ON public.auditoria_ocorrencia FOR SELECT TO public USING (true);
CREATE POLICY "Permitir insercao de auditoria a todos" ON public.auditoria_ocorrencia FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de notificacoes a todos" ON public.notificacoes;
DROP POLICY IF EXISTS "Permitir insercao de notificacoes a todos" ON public.notificacoes;
DROP POLICY IF EXISTS "Permitir atualizacao de notificacoes a todos" ON public.notificacoes;
CREATE POLICY "Permitir leitura de notificacoes a todos" ON public.notificacoes FOR SELECT TO public USING (true);
CREATE POLICY "Permitir insercao de notificacoes a todos" ON public.notificacoes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de notificacoes a todos" ON public.notificacoes FOR UPDATE TO public USING (true);

-- 14. RECARREGAR CACHE DO POSTGREST SCHEMA NO SUPABASE
NOTIFY pgrst, 'reload schema';
