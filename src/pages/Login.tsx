import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Aviso, BotonPrincipal, Campo, Card, Contenido, Header, Hero } from '../components/ui'

export default function LoginPage() {
  const { session, perfil, cargando, salir } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ya hay sesión: mandar a cada quien a su pantalla
  useEffect(() => {
    if (cargando || !session) return
    if (!perfil || !perfil.activo) {
      setError(
        perfil
          ? 'Tu cuenta está desactivada. Habla con quien coordina la jornada.'
          : 'No pudimos verificar tu cuenta. Intenta de nuevo en un momento.',
      )
      salir()
      return
    }
    navigate(perfil.rol === 'admin' ? '/admin' : '/caja', { replace: true })
  }, [session, perfil, cargando, navigate, salir])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setEnviando(false)
    if (error) {
      setError(
        error.message.toLowerCase().includes('invalid')
          ? 'El correo o la contraseña no coinciden. Revísalos e intenta otra vez.'
          : error.message,
      )
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <Header />
      <Hero etiqueta="Equipo Effetá" titulo="Hola de nuevo" subtitulo="Entra con tu cuenta para atender la jornada de ventas." />
      <Contenido className="-mt-10">
        <Card>
          <form onSubmit={entrar} className="space-y-4">
            <Campo
              label="Correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Campo
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <BotonPrincipal type="submit" icon={LogIn} disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </BotonPrincipal>
          </form>
        </Card>
      </Contenido>
    </div>
  )
}
