-- Migration: 001_initial_schema.sql
-- SAAS - Sistema de Triagem Operacional de Ocorrências de Fuga de Água

-- 1. Tabela clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  tipo_imovel TEXT CHECK (tipo_imovel IN ('residencia', 'comercio', 'edificio_publico')),
  endereco TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela ocorrencias
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  foto_url TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  local_fuga TEXT CHECK (local_fuga IN ('dentro_residencia', 'passeio', 'estrada', 'terreno', 'caixa_agua', 'conduta', 'outro')),
  agua_saindo_agora BOOLEAN,
  intensidade_reportada TEXT CHECK (intensidade_reportada IN ('gotas', 'pequeno_fluxo', 'fluxo_forte', 'jacto')),
  afeta_outros TEXT CHECK (afeta_outros IN ('nao', 'uma_residencia', 'varias_residencias', 'rua_zona', 'nao_sei')),
  classificacao_gemini JSONB,
  prioridade TEXT CHECK (prioridade IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  priority_score INTEGER,
  confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_validacao', 'validado', 'em_progresso', 'resolvido')),
  validado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para otimização de ordenação na fila de triagem
CREATE INDEX IF NOT EXISTS idx_ocorrencias_prioridade_criado ON public.ocorrencias (prioridade, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON public.ocorrencias (status);

-- 3. Row Level Security (RLS)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

-- NOTA DE ARQUITETURA:
-- As políticas abaixo utilizam permissões simples de roles do Supabase (authenticated e anon).
-- Quando o sistema de autenticação e papéis granulares de utilizador (ex: operador vs cliente final)
-- for implementado, estas políticas devem ser refinadas para validar perfis e papéis na tabela de utilizadores.

-- Policies para clientes
CREATE POLICY "Permitir leitura/escrita de clientes a utilizadores autenticados"
  ON public.clientes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies para ocorrencias
CREATE POLICY "Permitir submissao publica de ocorrencias (anonimos)"
  ON public.ocorrencias
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Permitir leitura total de ocorrencias a utilizadores autenticados"
  ON public.ocorrencias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir atualizacao de ocorrencias a utilizadores autenticados"
  ON public.ocorrencias
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir criacao de ocorrencias por utilizadores autenticados"
  ON public.ocorrencias
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
