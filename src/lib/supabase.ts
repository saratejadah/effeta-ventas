import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

/**
 * Cliente sin sesión, para crear los pedidos del link.
 * Así un pedido hecho desde /pedido siempre queda "A distancia", aunque en ese
 * navegador haya alguien del equipo con la sesión abierta.
 */
export const supabasePublico = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-publico' },
})
