import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { mensajeError } from '../../lib/format'
import { PATRON_USUARIO, usuarioVisible } from '../../lib/usuarios'
import type { Perfil } from '../../lib/types'
import { Aviso, BotonPrincipal, BotonSecundario, Campo, Card, Cargando, Contenido, IconBox, Pill, SectionLabel, TituloPagina } from '../../components/ui'

/** Llama a la función crear-cajero y devuelve sus datos o un mensaje de error legible */
async function funcionCajeros<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('crear-cajero', { body })
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
    return { data: null, error: msg }
  }
  if (data?.error) return { data: null, error: data.error }
  return { data: data as T, error: null }
}

export default function Cajeros() {
  const { perfil: yo } = useAuth()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cargar() {
    const { data, error } = await supabase.from('perfiles').select('*').order('rol').order('nombre')
    if (error) setError(error.message)
    else setPerfiles(data as Perfil[])
    setCargando(false)
    // Con qué usuario/correo entra cada uno (si falla, la lista se muestra igual)
    const r = await funcionCajeros<{ usuarios: Record<string, string> }>({ accion: 'listar' })
    if (r.data?.usuarios) setUsuarios(r.data.usuarios)
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
          onCreado={(nombre, usuario) => {
            setCreando(false)
            setAviso(`Listo: ${nombre} ya puede entrar con el usuario "${usuario}" y la contraseña que le diste.`)
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
                <FilaCajero
                  key={p.id}
                  perfil={p}
                  usuario={usuarios[p.id] ? usuarioVisible(usuarios[p.id]) : null}
                  esYo={p.id === yo?.id}
                  onToggle={() => toggleActivo(p)}
                  onClaveCambiada={() => setAviso(`Listo: ${p.nombre} ya puede entrar con su nueva contraseña.`)}
                />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </Contenido>
  )
}

function FilaCajero({
  perfil: p,
  usuario,
  esYo,
  onToggle,
  onClaveCambiada,
}: {
  perfil: Perfil
  usuario: string | null
  esYo: boolean
  onToggle: () => void
  onClaveCambiada: () => void
}) {
  const [cambiando, setCambiando] = useState(false)
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esCajero = p.rol === 'cajero'

  function cerrar() {
    setCambiando(false)
    setClave('')
    setError(null)
  }

  async function guardarClave(e: FormEvent) {
    e.preventDefault()
    if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setOcupado(true)
    setError(null)
    const r = await funcionCajeros({ accion: 'cambiar-clave', id: p.id, password: clave })
    setOcupado(false)
    if (r.error) return setError(r.error)
    cerrar()
    onClaveCambiada()
  }

  return (
    <li className={`px-4 py-3 ${p.activo ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        <IconBox icon={p.rol === 'admin' ? ShieldCheck : UserRound} color={p.rol === 'admin' ? 'amarillo' : 'verde'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {p.nombre}
            {esYo && <span className="font-normal text-muted"> (tú)</span>}
          </p>
          {usuario && <p className="truncate text-xs text-muted">Entra con: {usuario}</p>}
          <div className="mt-1 flex gap-1.5">
            <Pill color={p.rol === 'admin' ? 'indigo' : 'gris'}>{p.rol === 'admin' ? 'Admin' : 'Cajero'}</Pill>
            {p.activo ? <Pill color="verde">Activo</Pill> : <Pill color="gris">Desactivado</Pill>}
          </div>
        </div>
      </div>

      {cambiando ? (
        <form onSubmit={guardarClave} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              autoComplete="off"
              placeholder="Nueva contraseña (mín. 6)"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-[15px] outline-none focus:border-primary"
            />
            <button type="button" onClick={cerrar} className="px-2 text-muted" aria-label="Cancelar">
              <X size={18} />
            </button>
          </div>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <BotonPrincipal type="submit" icon={KeyRound} disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Guardar contraseña'}
          </BotonPrincipal>
        </form>
      ) : (
        !esYo && (
          <div className={`mt-3 grid gap-2 ${esCajero ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {esCajero && (
              <BotonSecundario className="px-2 py-2 text-[13px]" icon={KeyRound} onClick={() => setCambiando(true)}>
                Contraseña
              </BotonSecundario>
            )}
            <BotonSecundario className="px-2 py-2 text-[13px]" onClick={onToggle}>
              {p.activo ? 'Desactivar' : 'Activar'}
            </BotonSecundario>
          </div>
        )
      )}
    </li>
  )
}

function FormularioCajero({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (nombre: string, usuario: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear(e: FormEvent) {
    e.preventDefault()
    const u = usuario.trim().toLowerCase()
    if (!PATRON_USUARIO.test(u)) {
      return setError('El usuario debe tener de 3 a 30 letras o números, sin espacios ni tildes. Ej. caja1')
    }
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setEnviando(true)
    setError(null)
    const r = await funcionCajeros({ nombre: nombre.trim(), usuario: u, password })
    setEnviando(false)
    if (r.error) return setError(r.error)
    onCreado(nombre.trim(), u)
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
          label="Usuario"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="Ej. caja1"
          required
        />
        <p className="-mt-2 text-xs text-muted">Con esto entra a la caja. No necesita correo.</p>
        <Campo
          label="Contraseña"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
        />
        <p className="-mt-2 text-xs text-muted">Compártela con el cajero. Si la olvida, se la puedes cambiar desde esta lista.</p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <BotonPrincipal type="submit" icon={UserPlus} disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cajero'}
        </BotonPrincipal>
      </form>
    </Card>
  )
}
