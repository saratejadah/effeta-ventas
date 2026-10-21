import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck, UserPlus, UserRound, X } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { mensajeError } from '../../lib/format'
import type { Perfil } from '../../lib/types'
import { Aviso, BotonPrincipal, BotonSecundario, Campo, Card, Cargando, Contenido, IconBox, Pill, SectionLabel, TituloPagina } from '../../components/ui'

export default function Cajeros() {
  const { perfil: yo } = useAuth()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cargar() {
    const { data, error } = await supabase.from('perfiles').select('*').order('rol').order('nombre')
    if (error) setError(error.message)
    else setPerfiles(data as Perfil[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function toggleActivo(p: Perfil) {
    setError(null)
    const { error } = await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id)
    if (error) setError(mensajeError(error))
    else cargar()
  }

  return (
    <Contenido className="space-y-4 pt-5">
      <div>
        <TituloPagina>Cajeros</TituloPagina>
        <p className="mt-1 text-sm text-muted">Las personas que pueden vender en la caja.</p>
      </div>

      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

      {creando ? (
        <FormularioCajero
          onCerrar={() => setCreando(false)}
          onCreado={(nombre, email) => {
            setCreando(false)
            setAviso(`Listo: ${nombre} ya puede entrar con ${email} y la contraseña temporal que le diste.`)
            cargar()
          }}
        />
      ) : (
        <BotonPrincipal
          icon={UserPlus}
          onClick={() => {
            setAviso(null)
            setCreando(true)
          }}
        >
          Nuevo cajero
        </BotonPrincipal>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      {cargando ? (
        <Cargando />
      ) : (
        <section>
          <SectionLabel className="mb-2">Equipo</SectionLabel>
          <Card sinPadding>
            <ul className="divide-y divide-line">
              {perfiles.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.activo ? '' : 'opacity-60'}`}>
                  <IconBox icon={p.rol === 'admin' ? ShieldCheck : UserRound} color={p.rol === 'admin' ? 'amarillo' : 'verde'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {p.nombre}
                      {p.id === yo?.id && <span className="font-normal text-muted"> (tú)</span>}
                    </p>
                    <div className="mt-0.5 flex gap-1.5">
                      <Pill color={p.rol === 'admin' ? 'indigo' : 'gris'}>{p.rol === 'admin' ? 'Admin' : 'Cajero'}</Pill>
                      {p.activo ? <Pill color="verde">Activo</Pill> : <Pill color="gris">Desactivado</Pill>}
                    </div>
                  </div>
                  {p.id !== yo?.id && (
                    <BotonSecundario className="shrink-0 px-3 py-2 text-[13px]" onClick={() => toggleActivo(p)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </BotonSecundario>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </Contenido>
  )
}

function FormularioCajero({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (nombre: string, email: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('crear-cajero', {
      body: { nombre: nombre.trim(), email: email.trim().toLowerCase(), password },
    })
    setEnviando(false)
    if (error) {
      let msg = mensajeError(error)
      if (error instanceof FunctionsHttpError) {
        try {
          const cuerpo = await error.context.json()
          if (cuerpo?.error) msg = cuerpo.error
        } catch {
          /* respuesta sin JSON */
        }
      }
      setError(msg)
      return
    }
    if (data?.error) return setError(data.error)
    onCreado(nombre.trim(), email.trim().toLowerCase())
  }

  return (
    <Card destacada>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[15px] font-semibold">Nuevo cajero</p>
        <button onClick={onCerrar} className="text-muted" aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      <form onSubmit={crear} className="space-y-4">
        <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" required />
        <Campo
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="juan@ejemplo.com"
          required
        />
        <Campo
          label="Contraseña temporal"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
        />
        <p className="-mt-2 text-xs text-muted">Compártela con el cajero para que pueda entrar.</p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <BotonPrincipal type="submit" icon={UserPlus} disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cajero'}
        </BotonPrincipal>
      </form>
    </Card>
  )
}
