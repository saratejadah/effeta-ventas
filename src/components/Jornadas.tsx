import { useState, type FormEvent } from 'react'
import { CalendarDays, ChevronDown, Download, Lock, PlayCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { mensajeError, precio } from '../lib/format'
import type { Jornada } from '../lib/types'
import { Aviso, BotonPrincipal, BotonSecundario, Campo, Card } from './ui'

/** Lo que Resumen y Pedidos (admin) necesitan saber de las jornadas */
export interface VistaJornada {
  jornadas: Jornada[]
  abierta: Jornada | null
  /** La jornada que se está mirando */
  jornada: Jornada
  onElegir: (id: string) => void
  /** Después de abrir o cerrar una jornada: volver a mirar la más reciente */
  onCambio: () => void
}

export function fechaCorta(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Jornada 2 · en curso" o "Jornada 1 · 10 nov 2026" */
export function textoJornada(j: Jornada): string {
  return `${j.nombre} · ${j.abierta ? 'en curso' : fechaCorta(j.cerrada_at ?? j.created_at)}`
}

/** Selector para ver otra jornada (la más reciente primero) */
export function SelectorJornada({
  jornadas,
  actual,
  onElegir,
}: {
  jornadas: Jornada[]
  actual: Jornada
  onElegir: (id: string) => void
}) {
  return (
    <label className="relative block">
      <span className="sr-only">Ver jornada</span>
      <CalendarDays size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
      <select
        value={actual.id}
        onChange={(e) => onElegir(e.target.value)}
        disabled={jornadas.length < 2}
        className="w-full appearance-none rounded-xl border border-line bg-white py-3 pl-10 pr-10 text-[15px] font-semibold text-ink outline-none focus:border-primary disabled:opacity-100"
      >
        {jornadas.map((j) => (
          <option key={j.id} value={j.id}>
            {textoJornada(j)}
          </option>
        ))}
      </select>
      {jornadas.length > 1 && (
        <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
      )}
    </label>
  )
}

/** Botón y confirmación para cerrar la jornada abierta */
export function CerrarJornada({
  jornada,
  porCobrar,
  totalPorCobrar,
  onExportar,
  onCerrada,
}: {
  jornada: Jornada
  porCobrar: number
  totalPorCobrar: number
  onExportar: () => void
  onCerrada: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cerrar() {
    setOcupado(true)
    setError(null)
    const { error } = await supabase.rpc('cerrar_jornada')
    setOcupado(false)
    if (error) setError(mensajeError(error))
    else {
      setConfirmando(false)
      onCerrada()
    }
  }

  if (!confirmando) {
    return (
      <BotonSecundario icon={Lock} className="w-full text-danger" onClick={() => setConfirmando(true)}>
        Cerrar {jornada.nombre}
      </BotonSecundario>
    )
  }

  return (
    <Card className="space-y-3 border-danger/30">
      <p className="text-[15px] font-semibold">¿Cerrar {jornada.nombre}?</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>Sus ventas quedan guardadas y las puedes ver cuando quieras.</li>
        <li>
          El <span className="font-semibold text-ink">stock de todos los productos vuelve a 0</span>.
        </li>
        <li>La caja y el link de pedidos quedan en pausa hasta que abras una nueva jornada.</li>
      </ul>
      {porCobrar > 0 && (
        <Aviso tipo="error">
          Todavía hay {porCobrar} {porCobrar === 1 ? 'pedido' : 'pedidos'} por cobrar ({precio(totalPorCobrar)}). Si cierras, los
          podrás cobrar después desde Pedidos, eligiendo esta jornada.
        </Aviso>
      )}
      <BotonSecundario icon={Download} className="w-full" onClick={onExportar}>
        Descargar pedidos antes (CSV)
      </BotonSecundario>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="grid grid-cols-2 gap-2">
        <BotonSecundario disabled={ocupado} onClick={() => setConfirmando(false)}>
          No, volver
        </BotonSecundario>
        <button
          disabled={ocupado}
          onClick={cerrar}
          className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition active:opacity-85 disabled:opacity-40"
        >
          {ocupado ? 'Cerrando…' : 'Sí, cerrar'}
        </button>
      </div>
    </Card>
  )
}

/** Cuando no hay jornada abierta: avisa que todo está en pausa y permite abrir una nueva */
export function AbrirJornada({ sugerido, onAbierta }: { sugerido: string; onAbierta: () => void }) {
  const [nombre, setNombre] = useState(sugerido)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ponle un nombre a la jornada.')
    setOcupado(true)
    setError(null)
    const { error } = await supabase.rpc('abrir_jornada', { p_nombre: nombre.trim() })
    setOcupado(false)
    if (error) setError(mensajeError(error))
    else onAbierta()
  }

  return (
    <Card destacada>
      <form onSubmit={abrir} className="space-y-3">
        <div>
          <p className="text-[15px] font-semibold">No hay una jornada abierta</p>
          <p className="mt-1 text-sm text-muted">La caja y el link de pedidos están en pausa. Abre una nueva cuando quieras.</p>
        </div>
        <Campo label="Nombre de la nueva jornada" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <p className="text-xs text-muted">
          Recuerda cargar las unidades de cada producto en <span className="font-semibold">Productos</span> (todas están en 0).
          Puedes hacerlo antes o después de abrir.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <BotonPrincipal type="submit" icon={PlayCircle} disabled={ocupado}>
          {ocupado ? 'Abriendo…' : 'Abrir jornada'}
        </BotonPrincipal>
      </form>
    </Card>
  )
}

/** "Jornada 3" si las anteriores se llaman "Jornada 1", "Jornada 2"… */
export function nombreSiguiente(jornadas: Jornada[]): string {
  const maximo = jornadas.reduce((m, j) => {
    const n = /^jornada\s+(\d+)$/i.exec(j.nombre.trim())
    return n ? Math.max(m, Number(n[1])) : m
  }, 0)
  return `Jornada ${Math.max(maximo, jornadas.length) + 1}`
}
