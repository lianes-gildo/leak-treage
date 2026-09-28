-- Migration: 002_phase2_schema.sql
-- SAAS - Fase 2: Cadastro GIS, Deduplicação, Motores de Despacho, SLA e Feedback

-- 1. Tabela rede_cadastro (Cadastro de Ativos de Rede GIS)
CREATE TABLE IF NOT EXISTS public.rede_cadastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_ativo TEXT NOT NULL,
  tipo_infraestrutura TEXT NOT NULL CHECK (tipo_infraestrutura IN ('residencial', 'secundaria', 'principal', 'reservatorio', 'outro')),
  diametro_mm INTEGER NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  clientes_estimados INTEGER NOT NULL DEFAULT 0,
  pressao_estimada_bar NUMERIC,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index espacial aproximado para consultas por coordenadas
CREATE INDEX IF NOT EXISTS idx_rede_cadastro_coords ON public.rede_cadastro (latitude, longitude);

-- 2. Tabela grupos_ocorrencia (Agrupamento e Deduplicação)
CREATE TABLE IF NOT EXISTS public.grupos_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prioridade_consolidada TEXT CHECK (prioridade_consolidada IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  quantidade_reportes INTEGER NOT NULL DEFAULT 1,
  raio_metros INTEGER NOT NULL DEFAULT 50,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Atualização da Tabela ocorrencias com novos campos da Fase 2
ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.grupos_ocorrencia(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_limite TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalonada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prioridade_original TEXT CHECK (prioridade_original IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  ADD COLUMN IF NOT EXISTS fontes_dados JSONB,
  ADD COLUMN IF NOT EXISTS decisao_despacho JSONB;

-- Índices para buscas rápidas de SLA e agendamento
CREATE INDEX IF NOT EXISTS idx_ocorrencias_grupo_id ON public.ocorrencias (grupo_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_sla_escalonamento ON public.ocorrencias (status, escalonada, sla_limite);

-- 4. Tabela feedback_validacao (Ciclo de Aprendizagem / Feedback do Operador)
CREATE TABLE IF NOT EXISTS public.feedback_validacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  prioridade_sugerida TEXT NOT NULL CHECK (prioridade_sugerida IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  prioridade_confirmada TEXT NOT NULL CHECK (prioridade_confirmada IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  concordou BOOLEAN NOT NULL,
  fontes_dados JSONB,
  validado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Row Level Security (RLS)
ALTER TABLE public.rede_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_validacao ENABLE ROW LEVEL SECURITY;

-- Policies para rede_cadastro
CREATE POLICY "Permitir leitura de rede_cadastro a todos"
  ON public.rede_cadastro FOR SELECT TO public USING (true);

CREATE POLICY "Permitir escrita em rede_cadastro a autenticados"
  ON public.rede_cadastro FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies para grupos_ocorrencia
CREATE POLICY "Permitir leitura de grupos a todos"
  ON public.grupos_ocorrencia FOR SELECT TO public USING (true);

CREATE POLICY "Permitir criacao e atualizacao de grupos a autenticados e servicos"
  ON public.grupos_ocorrencia FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies para feedback_validacao
CREATE POLICY "Permitir leitura de feedback a autenticados"
  ON public.feedback_validacao FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercao de feedback a autenticados"
  ON public.feedback_validacao FOR INSERT TO authenticated WITH CHECK (true);
