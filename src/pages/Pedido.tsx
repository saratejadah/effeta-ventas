import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ImageOff, ShoppingBag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProductos } from '../lib/hooks'
import { ajustarCarrito, fijarCantidad, lineasCarrito } from '../lib/carrito'
import { mensajeError, numeroPedido, precio } from '../lib/format'
import type { Carrito, Producto } from '../lib/types'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Card,
  Cargando,
  Contenido,
  Header,
  Hero,
  SectionLabel,
  Stepper,
  StockPill,
} from '../components/ui'

type Paso = 'elegir' | 'datos' | 'listo'

interface Confirmacion {
  numero: number
  nombre: string
  total: number
  lineas: { nombre: string; cantidad: number; subtotal: number }[]
}

export default function PedidoPage() {
  const { productos, cargando, error: errorCarga, recargar } = useProductos()
  const [carrito, setCarrito] = useState<Carrito>({})
  const [paso, setPaso] = useState<Paso>('elegir')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)

  // Si el stock baja mientras la persona elige, ajustamos su carrito
  useEffect(() => {
    setCarrito((c) => ajustarCarrito(c, productos))
  }, [productos])

  const lineas = useMemo(() => lineasCarrito(carrito, productos), [productos, carrito])
  const total = lineas.reduce((s, l) => s + l.subtotal, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  function cambiar(p: Producto, n: number) {
    setCarrito((c) => fijarCantidad(c, p, n))
  }

  async function hacerPedido() {
    if (!nombre.trim()) {
      setError('Cuéntanos tu nombre para poder entregarte el pedido.')
      return
    }
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim() || null,
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    })
    setEnviando(false)

    if (error) {
      const msg = mensajeError(error)
      if (msg.toLowerCase().includes('stock')) {
        setError('Alguien se adelantó y ya no quedan suficientes unidades de algún producto. Revisa las cantidades y vuelve a intentarlo.')
        await recargar()
        setPaso('elegir')
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
      lineas: lineas.map((l) => ({ nombre: l.producto.nombre, cantidad: l.cantidad, subtotal: l.subtotal })),
    })
    setCarrito({})
    setPaso('listo')
    window.scrollTo({ top: 0 })
  }

  function nuevoPedido() {
    setConfirmacion(null)
    setNombre('')
    setTelefono('')
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
              Muestra este número al recoger y pagar.
            </p>
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
          </Card>

          <BotonSecundario onClick={nuevoPedido} className="w-full">
            Hacer otro pedido
          </BotonSecundario>
        </Contenido>
      </div>
    )
  }

  /* ---------- Datos del comprador ---------- */
  if (paso === 'datos') {
    return (
      <div className="min-h-dvh pb-10">
        <Header />
        <Contenido className="space-y-4 pt-5">
          <button onClick={() => setPaso('elegir')} className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <ArrowLeft size={16} /> Volver a los productos
          </button>
          <h1 className="font-serif text-[28px] font-bold leading-tight text-primary">Tu pedido</h1>

          <Card>
            <SectionLabel className="mb-3">Resumen</SectionLabel>
            <ul className="divide-y divide-line">
              {lineas.map((l) => (
                <li key={l.producto.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{l.producto.nombre}</p>
                    <p className="text-[13px] text-muted">{precio(l.subtotal)}</p>
                  </div>
                  <Stepper valor={l.cantidad} max={l.producto.stock} onChange={(n) => cambiar(l.producto, n)} />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-accent tabular-nums">{precio(total)}</span>
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionLabel>Tus datos</SectionLabel>
            <Campo
              label="Nombre"
              placeholder="¿Cómo te llamas?"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
              required
            />
            <Campo
              label="Teléfono (opcional)"
              placeholder="Por si necesitamos avisarte algo"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
          </Card>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <BotonPrincipal onClick={hacerPedido} disabled={enviando || unidades === 0}>
            {enviando ? 'Enviando…' : `Hacer pedido · ${precio(total)}`}
          </BotonPrincipal>
        </Contenido>
      </div>
    )
  }

  /* ---------- Elegir productos ---------- */
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <Hero
        etiqueta="Effetá Mazuren"
        titulo="Jornada de ventas"
        subtitulo="Elige lo que quieras llevar, haz tu pedido y recógelo en la caja. ¡Gracias por apoyarnos!"
      />
      <Contenido className="-mt-10 space-y-3">
        {error && <Aviso tipo="error">{error}</Aviso>}
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
          productos.map((p) => <TarjetaProducto key={p.id} producto={p} cantidad={carrito[p.id] ?? 0} onChange={(n) => cambiar(p, n)} />)
        )}
      </Contenido>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[600px]">
          <BotonPrincipal
            icon={ShoppingBag}
            disabled={unidades === 0}
            onClick={() => {
              setError(null)
              setPaso('datos')
              window.scrollTo({ top: 0 })
            }}
          >
            {unidades === 0
              ? 'Elige tus productos'
              : `Continuar · ${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${precio(total)}`}
          </BotonPrincipal>
        </div>
      </div>
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
