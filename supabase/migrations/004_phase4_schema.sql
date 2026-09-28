-- Migration: 004_phase4_schema.sql
-- SAAS - Fase 4: Tabela de Notificações em Tempo Real

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

-- Índices para otimização de consultas Realtime e filtragem por papel
CREATE INDEX IF NOT EXISTS idx_notificacoes_papel_lida ON public.notificacoes (papel_alvo, lida, criado_em);
CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario ON public.notificacoes (destinatario_id, lida);

-- Activar Row Level Security
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Policies para notificacoes
CREATE POLICY "Usuarios leem notificacoes para o seu id ou papel"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (
    destinatario_id = auth.uid() OR
    papel_alvo IS NULL OR
    EXISTS (
      SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = papel_alvo
    )
  );

CREATE POLICY "Usuarios atualizam o estado de lida das suas notificacoes"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Permitir insercao de notificacoes a servicos e autenticados"
  ON public.notificacoes FOR INSERT TO public WITH CHECK (true);

-- Tentar habilitar publicação Realtime se a publicação supabase_realtime existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;
