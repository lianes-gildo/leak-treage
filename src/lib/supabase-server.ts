import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cria o cliente Supabase Server.
 * Tenta utilizar a Service Role key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY)
 * para ignorar o RLS em operações administrativas no backend. Se não estiver configurada,
 * faz fallback para a chave pública (ANON / PUBLISHABLE).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!url || !key) {
    throw new Error('Supabase URL ou Key não estão configurados nas variáveis de ambiente.')
  }

  return createSupabaseClient(url, key)
}
