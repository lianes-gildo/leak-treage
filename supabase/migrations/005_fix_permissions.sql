-- ==============================================================================
-- SAAS FUGA DE ÁGUA - REPARAÇÃO TOTAL DE PERMISSÕES POSTGRES & RLS
-- Execute este script no SQL Editor do seu projeto Supabase para resolver "permission denied for table ocorrencias"
-- ==============================================================================

-- 1. CONCEDER USAGE E PERMISSÕES DE TABELA AOS ROLES ANON, AUTHENTICATED E SERVICE_ROLE
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role, postgres;

-- 2. LIMPAR E RECRIAR POLÍTICAS DE ACESSO (RLS) DE FORMA TOTALMENTE PERMISSIVA

-- Ocorrências
DROP POLICY IF EXISTS "Permitir leitura de ocorrencias a todos" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir leitura de ocorrencias a autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir submissao publica de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir submissao de ocorrencias a todos" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir atualizacao de ocorrencias a autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir atualizacao de ocorrencias a todos" ON public.ocorrencias;

CREATE POLICY "Permitir leitura de ocorrencias a todos"
  ON public.ocorrencias FOR SELECT TO public USING (true);

CREATE POLICY "Permitir submissao de ocorrencias a todos"
  ON public.ocorrencias FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Permitir atualizacao de ocorrencias a todos"
  ON public.ocorrencias FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Grupos de Ocorrência
DROP POLICY IF EXISTS "Permitir leitura de grupos a todos" ON public.grupos_ocorrencia;
DROP POLICY IF EXISTS "Permitir leitura de grupos a autenticados" ON public.grupos_ocorrencia;
DROP POLICY IF EXISTS "Permitir operacoes em grupos a todos" ON public.grupos_ocorrencia;
DROP POLICY IF EXISTS "Permitir escrita em grupos a autenticados" ON public.grupos_ocorrencia;

CREATE POLICY "Permitir leitura de grupos a todos"
  ON public.grupos_ocorrencia FOR SELECT TO public USING (true);

CREATE POLICY "Permitir operacoes em grupos a todos"
  ON public.grupos_ocorrencia FOR ALL TO public USING (true);

-- Notificações
DROP POLICY IF EXISTS "Permitir leitura de notificacoes a todos" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuarios leem notificacoes para o seu id ou papel" ON public.notificacoes;
DROP POLICY IF EXISTS "Permitir insercao de notificacoes a todos" ON public.notificacoes;
DROP POLICY IF EXISTS "Permitir insercao de notificacoes a servicos e autenticados" ON public.notificacoes;
DROP POLICY IF EXISTS "Permitir atualizacao de notificacoes a todos" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuarios atualizam o estado de lida das suas notificacoes" ON public.notificacoes;

CREATE POLICY "Permitir leitura de notificacoes a todos"
  ON public.notificacoes FOR SELECT TO public USING (true);

CREATE POLICY "Permitir insercao de notificacoes a todos"
  ON public.notificacoes FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Permitir atualizacao de notificacoes a todos"
  ON public.notificacoes FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Feedback de Validação
DROP POLICY IF EXISTS "Permitir insercao de feedback a todos" ON public.feedback_validacao;
DROP POLICY IF EXISTS "Permitir insercao de feedback a autenticados" ON public.feedback_validacao;
DROP POLICY IF EXISTS "Permitir leitura de feedback a todos" ON public.feedback_validacao;
DROP POLICY IF EXISTS "Permitir leitura de feedback a autenticados" ON public.feedback_validacao;

CREATE POLICY "Permitir insercao de feedback a todos"
  ON public.feedback_validacao FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Permitir leitura de feedback a todos"
  ON public.feedback_validacao FOR SELECT TO public USING (true);

-- Rede Cadastro (GIS)
DROP POLICY IF EXISTS "Permitir leitura de rede_cadastro a todos" ON public.rede_cadastro;
DROP POLICY IF EXISTS "Permitir leitura de rede_cadastro a autenticados" ON public.rede_cadastro;

CREATE POLICY "Permitir leitura de rede_cadastro a todos"
  ON public.rede_cadastro FOR SELECT TO public USING (true);

-- Clientes
DROP POLICY IF EXISTS "Permitir leitura de clientes a todos" ON public.clientes;
DROP POLICY IF EXISTS "Permitir leitura de clientes a autenticados" ON public.clientes;

CREATE POLICY "Permitir leitura de clientes a todos"
  ON public.clientes FOR SELECT TO public USING (true);

-- Perfis, Equipas e Auditoria
DROP POLICY IF EXISTS "Permitir leitura de perfis a todos" ON public.perfis;
DROP POLICY IF EXISTS "Permitir leitura de perfis a autenticados" ON public.perfis;
CREATE POLICY "Permitir leitura de perfis a todos" ON public.perfis FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de equipas a todos" ON public.equipas;
DROP POLICY IF EXISTS "Permitir leitura de equipas a autenticados" ON public.equipas;
CREATE POLICY "Permitir leitura de equipas a todos" ON public.equipas FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir leitura de auditoria a todos" ON public.auditoria_ocorrencia;
DROP POLICY IF EXISTS "Permitir leitura de auditoria a autenticados" ON public.auditoria_ocorrencia;
CREATE POLICY "Permitir leitura de auditoria a todos" ON public.auditoria_ocorrencia FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir insercao de auditoria a todos" ON public.auditoria_ocorrencia;
CREATE POLICY "Permitir insercao de auditoria a todos" ON public.auditoria_ocorrencia FOR INSERT TO public WITH CHECK (true);

-- 3. FORÇAR RECARGA DO CACHE DO POSTGREST SCHEMA NO SUPABASE
NOTIFY pgrst, 'reload schema';
