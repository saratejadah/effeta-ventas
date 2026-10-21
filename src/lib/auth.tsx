import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil } from './types'

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  salir: () => Promise<void>
}

async function salir() {
  await supabase.auth.signOut()
}

const AuthContext = createContext<AuthState>({ session: null, perfil: null, cargando: true, salir: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [iniciando, setIniciando] = useState(true)
  // Guardamos de qué usuario es el perfil cargado, para saber si sigue cargando
  const [cargado, setCargado] = useState<{ userId: string; perfil: Perfil | null } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIniciando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      setIniciando(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Cargar el perfil (nombre y rol) cuando cambia el usuario
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let vivo = true
    supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return
        setCargado({ userId, perfil: (data as Perfil) ?? null })
      })
    return () => {
      vivo = false
    }
  }, [userId])

  const cargando = iniciando || (!!userId && cargado?.userId !== userId)
  const perfil = userId && cargado?.userId === userId ? cargado.perfil : null

  return <AuthContext.Provider value={{ session, perfil, cargando, salir }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
