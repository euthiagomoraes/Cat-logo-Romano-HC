import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false quando as variáveis de ambiente não foram configuradas. */
export const supabaseConfigurado = Boolean(url && chave);

export const supabase = createClient(url || 'http://localhost:54321', chave || 'chave-ausente', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
