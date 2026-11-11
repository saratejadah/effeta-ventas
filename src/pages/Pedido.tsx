import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ImageOff, PauseCircle, ShoppingBag, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useJornadas, useProductos } from '../lib/hooks'
import { ajustarCarrito, fijarCantidad, lineasCarrito } from '../lib/carrito'
import { mensajeError, numeroPedido, precio } from '../lib/format'
import { textoMetodo } from '../lib/pago'
import type { Carrito, MetodoPago, Producto } from '../lib/types'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Card,
  Cargando,
  Contenido,
  DatosTransferencia,
  Header,
  Hero,
  SectionLabel,
  SelectorMetodoPago,
  Stepper,
  StockPill,
} from '../components/ui'

type Paso = 'elegir' | 'listo'

interface Confirmacion {
  numero: number
  nombre: string
  total: number
  metodo: MetodoPago
  lineas: { nombre: string; cantidad: number; subtotal: number }[]
}

export default function PedidoPage() {
  const { productos, cargando, error: errorCarga, recargar } = useProductos()
  const jornadas = useJornadas()
  // En pausa: ya se sabe que no hay jornada abierta (si falla la consulta, dejamos pedir y decide el servidor)
  const enPausa = !jornadas.cargando && !jornadas.error && !jornadas.abierta
  const [carrito, setCarrito] = useState<Carrito>({})
  const [paso, setPaso] = useState<Paso>('elegir')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [abierto, setAbierto] = useState(false) // panel "Tu pedido" en celular

  // Si el stock baja mientras la persona elige, ajustamos su carrito
  useEffect(() => {
    setCarrito((c) => ajustarCarrito(c, productos))
  }, [productos])

  const lineas = useMemo(() => lineasCarrito(carrito, productos), [productos, carrito])
  const total = lineas.reduce((s, l) => s + l.subtotal, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  useEffect(() => {
    if (unidades === 0) setAbierto(false)
  }, [unidades])

  function cambiar(p: Producto, n: number) {
    setCarrito((c) => fijarCantidad(c, p, n))
  }

  async function hacerPedido() {
    if (!nombre.trim()) {
      setError('Cuéntanos tu nombre para poder entregarte el pedido.')
      return
    }
    if (!metodo) {
      setError('Elige cómo vas a pagar.')
      return
    }
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim() || null,
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      p_metodo_pago: metodo,
    })
    setEnviando(false)

    if (error) {
      const msg = mensajeError(error)
      if (msg.toLowerCase().includes('jornada')) {
        await jornadas.recargar()
        setError('En este momento no estamos recibiendo pedidos.')
      } else if (msg.toLowerCase().includes('stock')) {
        setError('Alguien se adelantó y ya no quedan suficientes unidades de algún producto. Revisa las cantidades y vuelve a intentarlo.')
        await recargar()
      } else {
        setError(msg)
      }
      return
    }

    const fila = Array.isArray(data) ? data[0] : data
    setConfirmacion({
      numero: fila.out_numero,
      nombre: nombre.trim(),
      total: Number(fila.out_total),
      metodo,
      lineas: lineas.map((l) => ({ nombre: l.producto.nombre, cantidad: l.cantidad, subtotal: l.subtotal })),
    })
    setCarrito({})
    setAbierto(false)
    setPaso('listo')
    window.scrollTo({ top: 0 })
  }

  function nuevoPedido() {
    setConfirmacion(null)
    setNombre('')
    setTelefono('')
    setMetodo(null)
    setPaso('elegir')
    window.scrollTo({ top: 0 })
  }

  /* ---------- Confirmación ---------- */
  if (paso === 'listo' && confirmacion) {
    return (
      <div className="min-h-dvh pb-10">
        <Header />
        <Hero etiqueta="Effetá Mazuren" titulo="¡Pedido recibido!" subtitulo="Gracias por apoyar al grupo. Te esperamos." />
        <Contenido className="-mt-10 space-y-4">
          <Card destacada className="relative">
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={20} />
              <span className="text-sm font-semibold">¡Listo, {confirmacion.nombre}!</span>
            </div>
            <p className="mt-3 text-[15px] text-muted">Tu pedido es el</p>
            <p className="font-serif text-[64px] font-bold leading-none text-primary">
              {numeroPedido(confirmacion.numero)}
            </p>
            <p className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-sm font-medium text-warn">
              {confirmacion.metodo === 'transferencia'
                ? 'Haz la transferencia y muestra este número con el comprobante al recoger.'
                : 'Muestra este número al recoger y pagar.'}
            </p>
            {confirmacion.metodo === 'transferencia' && (
              <div className="mt-3">
                <DatosTransferencia />
              </div>
            )}
          </Card>

          <Card>
            <SectionLabel className="mb-3">Detalle del pedido</SectionLabel>
            <ul className="divide-y divide-line">
              {confirmacion.lineas.map((l) => (
                <li key={l.nombre} className="flex justify-between py-2.5 text-[15px]">
                  <span>
                    <span className="font-semibold">{l.cantidad}×</span> {l.nombre}
                  </span>
                  <span className="tabular-nums">{precio(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-accent tabular-nums">{precio(confirmacion.total)}</span>
            </div>
            <p className="mt-3 text-sm text-muted">
              Vas a pagar con <span className="font-semibold text-ink">{textoMetodo(confirmacion.metodo)}</span>
            </p>
          </Card>

          <BotonSecundario onClick={nuevoPedido} className="w-full">
            Hacer otro pedido
          </BotonSecundario>
        </Contenido>
      </div>
    )
  }

  /* ---------- Sin jornada abierta ---------- */
  if (enPausa) {
    return (
      <div className="min-h-dvh pb-10">
        <Header />
        <Hero
          etiqueta="Effetá Mazuren"
          titulo="Pronto volvemos"
          subtitulo="Gracias por apoyar al grupo. ¡Te esperamos en la próxima jornada!"
        />
        <Contenido className="-mt-10">
          <Card className="text-center">
            <PauseCircle size={36} strokeWidth={1.5} className="mx-auto text-primary" />
            <p className="mt-3 text-[17px] font-semibold">En este momento no estamos recibiendo pedidos</p>
            <p className="mt-1 text-sm text-muted">Pronto abriremos una nueva jornada de ventas. Vuelve a este mismo link.</p>
          </Card>
        </Contenido>
      </div>
    )
  }

  /* ---------- Tu pedido: cantidades, datos, pago y enviar ---------- */
  const panel = (
    <div className="space-y-4">
      {lineas.length === 0 ? (
        <p className="text-sm text-muted">Todavía no has elegido productos. Usa + en los que quieras llevar.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lineas.map((l) => (
            <li key={l.producto.id} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{l.producto.nombre}</p>
                <p className="text-xs text-muted tabular-nums">{precio(l.subtotal)}</p>
              </div>
              <Stepper valor={l.cantidad} max={l.producto.stock} onChange={(n) => cambiar(l.producto, n)} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-2xl font-bold text-accent tabular-nums">{precio(total)}</span>
      </div>

      <div className="space-y-2.5">
        <SectionLabel>Tus datos</SectionLabel>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          autoComplete="name"
          aria-label="Nombre"
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-primary"
        />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono (opcional)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Teléfono (opcional)"
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>¿Cómo vas a pagar?</SectionLabel>
        <SelectorMetodoPago
          valor={metodo}
          onChange={(m) => {
            setMetodo(m)
            setError(null)
          }}
        />
        {metodo === 'transferencia' ? <DatosTransferencia /> : <p className="text-xs text-muted">Pagas al recoger tu pedido en la caja.</p>}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={hacerPedido} disabled={enviando || unidades === 0}>
        {enviando ? 'Enviando…' : unidades === 0 ? 'Elige tus productos' : `Hacer pedido · ${precio(total)}`}
      </BotonPrincipal>
    </div>
  )

  /* ---------- Elegir productos ---------- */
  return (
    <div className="min-h-dvh pb-32 lg:pb-10">
      <Header ancho />
      <Hero
        ancho
        etiqueta="Effetá Mazuren"
        titulo="Jornada de ventas"
        subtitulo="Elige lo que quieras llevar, haz tu pedido y recógelo en la caja. ¡Gracias por apoyarnos!"
      />
      <main className="relative mx-auto -mt-10 w-full max-w-[600px] px-4 lg:grid lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="space-y-3">
          {error && !abierto && <Aviso tipo="error">{error}</Aviso>}
          {cargando ? (
            <Card>
              <Cargando />
            </Card>
          ) : errorCarga ? (
            <Card>
              <Aviso tipo="error">No pudimos cargar los productos. Revisa tu conexión e intenta de nuevo.</Aviso>
            </Card>
          ) : productos.length === 0 ? (
            <Card className="text-center">
              <p className="text-[15px] font-semibold">Todavía no hay productos</p>
              <p className="mt-1 text-sm text-muted">Vuelve en un ratico, ya casi empezamos.</p>
            </Card>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {productos.map((p) => (
                <TarjetaProducto key={p.id} producto={p} cantidad={carrito[p.id] ?? 0} onChange={(n) => cambiar(p, n)} />
              ))}
            </div>
          )}
        </div>

        {/* Computador: "Tu pedido" siempre visible a la derecha */}
        <aside className="hidden lg:sticky lg:top-[72px] lg:block">
          <div className="max-h-[calc(100dvh-88px)] overflow-y-auto rounded-2xl border border-line bg-white p-4">
            <p className="mb-3 font-serif text-[22px] font-bold text-primary">Tu pedido</p>
            {panel}
          </div>
        </aside>
      </main>

      {/* Celular: barra corta abajo; "Ver mi pedido" abre el panel */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[600px] items-center gap-3">
          {unidades > 0 && (
            <div className="shrink-0">
              <p className="text-[11px] text-muted">
                {unidades} {unidades === 1 ? 'producto' : 'productos'}
              </p>
              <p className="text-xl font-bold tabular-nums text-ink">{precio(total)}</p>
            </div>
          )}
          <BotonPrincipal
            icon={ShoppingBag}
            disabled={unidades === 0}
            onClick={() => {
              setError(null)
              setAbierto(true)
            }}
          >
            {unidades === 0 ? 'Elige tus productos' : 'Ver mi pedido'}
          </BotonPrincipal>
        </div>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Tu pedido">
          <button className="absolute inset-0 bg-ink/40" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
            <div className="sticky top-0 z-10 -mx-4 mb-2 border-b border-line bg-white px-4 pb-2 pt-1">
              <span className="mx-auto mb-1.5 block h-1.5 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between">
                <p className="font-serif text-[22px] font-bold text-primary">Tu pedido</p>
                <button onClick={() => setAbierto(false)} className="-mr-1.5 rounded-full p-1.5 text-muted" aria-label="Cerrar">
                  <X size={22} />
                </button>
              </div>
            </div>
            <div className="mx-auto max-w-[600px]">{panel}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaProducto({ producto: p, cantidad, onChange }: { producto: Producto; cantidad: number; onChange: (n: number) => void }) {
  const agotado = p.stock <= 0
  return (
    <div className={`flex gap-4 rounded-2xl border border-line bg-white p-3 ${agotado ? 'opacity-60' : ''}`}>
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-page">
        {p.imagen_url ? (
          <img src={p.imagen_url} alt={p.nombre} className={`h-full w-full object-cover ${agotado ? 'grayscale' : ''}`} loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted/50">
            <ImageOff size={24} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold leading-snug">{p.nombre}</p>
          <StockPill stock={p.stock} />
        </div>
        {p.descripcion && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{p.descripcion}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="text-[17px] font-bold text-ink tabular-nums">{precio(p.precio)}</p>
          <Stepper valor={cantidad} max={p.stock} onChange={onChange} disabled={agotado} />
        </div>
      </div>
    </div>
  )
}
