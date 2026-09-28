-- Migration: 003_phase3_schema.sql
-- SAAS - Fase 3: Autenticação, Papéis, Submissão Pública, Atribuição de Equipas e Auditoria

-- 1. Tabela perfis (Perfil de Usuário estendendo auth.users)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('operador', 'supervisor', 'admin')),
  equipa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela equipas (Equipas Técnicas de Manutenção e Reparação)
CREATE TABLE IF NOT EXISTS public.equipas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipos_infraestrutura TEXT[] NOT NULL DEFAULT '{}',
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Atualização da Tabela ocorrencias com colunas da Fase 3
ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS contacto_cliente TEXT,
  ADD COLUMN IF NOT EXISTS equipa_atribuida TEXT,
  ADD COLUMN IF NOT EXISTS atribuido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atribuido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ocorrencias_contacto ON public.ocorrencias (contacto_cliente);

-- 4. Tabela auditoria_ocorrencia (Trilha Auditável de Decisões e Alterações)
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

CREATE INDEX IF NOT EXISTS idx_auditoria_ocorrencia_id ON public.auditoria_ocorrencia (ocorrencia_id);

-- 5. Row Level Security (RLS) - Regras Estritas por Papel

-- Activar RLS em todas as tabelas
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_ocorrencia ENABLE ROW LEVEL SECURITY;

-- 5.1 Policies para perfis
CREATE POLICY "Usuarios leem o seu proprio perfil ou admins leem todos"
  ON public.perfis FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin'
    )
  );

CREATE POLICY "Apenas admins atualizam perfis"
  ON public.perfis FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin'
    )
  );

-- 5.2 Policies para equipas
CREATE POLICY "Todos os autenticados leem equipas"
  ON public.equipas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisores e admins gerenciam equipas"
  ON public.equipas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('supervisor', 'admin')
    )
  );

-- 5.3 Policies para auditoria_ocorrencia
CREATE POLICY "Leitura de auditoria para autenticados"
  ON public.auditoria_ocorrencia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insercao de auditoria para autenticados e servicos"
  ON public.auditoria_ocorrencia FOR INSERT TO public WITH CHECK (true);

-- 5.4 Substituição e Reforço de Policies na tabela ocorrencias
DROP POLICY IF EXISTS "Permitir insercao anonima de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir leitura de ocorrencias a autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir atualizacao de ocorrencias a autenticados" ON public.ocorrencias;

-- Permitir inserção pública (clientes reportando sem login)
CREATE POLICY "Permitir submissao publica de ocorrencias"
  ON public.ocorrencias FOR INSERT TO public WITH CHECK (true);

-- Permitir leitura de ocorrências a usuários autenticados
CREATE POLICY "Permitir leitura de ocorrencias a autenticados"
  ON public.ocorrencias FOR SELECT TO authenticated USING (true);

-- Permitir atualização de operação (operador, supervisor, admin)
CREATE POLICY "Operadores supervisores e admins atualizam ocorrencias"
  ON public.ocorrencias FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('operador', 'supervisor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('operador', 'supervisor', 'admin')
    )
  );

-- 5.5 Reforço de Policies na tabela rede_cadastro
DROP POLICY IF EXISTS "Permitir escrita em rede_cadastro a autenticados" ON public.rede_cadastro;

CREATE POLICY "Supervisores e admins editam rede_cadastro"
  ON public.rede_cadastro FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('supervisor', 'admin')
    )
  );

-- 6. Inserção de Equipas Iniciais de Exemplo
INSERT INTO public.equipas (nome, tipos_infraestrutura, ativa)
VALUES 
  ('Equipa Alpha - Redes Secundárias e Residenciais', ARRAY['residencial', 'secundaria', 'residencia', 'outro'], true),
  ('Equipa Beta - Grandes Condutas e Reservatórios', ARRAY['principal', 'reservatorio', 'conduta'], true)
ON CONFLICT DO NOTHING;
