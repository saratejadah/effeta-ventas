import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, PauseCircle, X, Search, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useJornadas, usePedidos, useProductos } from '../lib/hooks'
import { ajustarCarrito, fijarCantidad, lineasCarrito } from '../lib/carrito'
import { mensajeError, numeroPedido, precio } from '../lib/format'
import { textoMetodo } from '../lib/pago'
import type { Carrito, MetodoPago } from '../lib/types'
import { PedidoCard } from '../components/PedidoCard'
import { AccionesPago, debePago } from '../components/AccionesPago'
import { TarjetaProducto } from '../components/TarjetaProducto'
import { sugerencias } from '../components/Vueltas'
import {
  Aviso,
  BotonPrincipal,
  BottomNav,
  Card,
  Cargando,
  Contenido,
  DatosTransferencia,
  Header,
  SectionLabel,
  SelectorMetodoPago,
  Stepper,
  TituloPagina,
  type Tab,
} from '../components/ui'

type Pestana = 'vender' | 'pedidos'

const tabs: Tab<Pestana>[] = [
  { id: 'vender', texto: 'Vender', icon: ShoppingCart },
  { id: 'pedidos', texto: 'Pedidos', icon: ClipboardList },
]

export default function CajaPage() {
  const { perfil, salir } = useAuth()
  const [pestana, setPestana] = useState<Pestana>('vender')
  const [filtro, setFiltro] = useState<Filtro>('por-cobrar')
  const { abierta, cargando, error } = useJornadas()
  const pedidos = usePedidos(abierta ? abierta.id : cargando ? undefined : null)

  return (
    <div className="min-h-dvh">
      <Header nombre={perfil?.nombre} onSalir={salir} ancho />
      {cargando ? (
        <Contenido className="pt-5">
          <Cargando />
        </Contenido>
      ) : error ? (
        <Contenido className="pt-5">
          <Aviso tipo="error">No pudimos cargar la jornada: {error}</Aviso>
        </Contenido>
      ) : !abierta ? (
        <Contenido className="pt-10">
          <Card className="text-center">
            <PauseCircle size={36} strokeWidth={1.5} className="mx-auto text-primary" />
            <p className="mt-3 text-[17px] font-semibold">La caja está en pausa</p>
            <p className="mt-1 text-sm text-muted">
              No hay una jornada de ventas abierta. Cuando el admin abra una nueva, aquí podrás vender de nuevo.
            </p>
          </Card>
        </Contenido>
      ) : pestana === 'vender' ? (
        <Vender nombreCajero={perfil?.nombre} />
      ) : (
        <PedidosOnline {...pedidos} filtro={filtro} onFiltro={setFiltro} />
      )}
      <BottomNav tabs={tabs} activo={pestana} onChange={setPestana} ancho />
    </div>
  )
}

/* ================= Vender ================= */

function Vender({ nombreCajero }: { nombreCajero?: string }) {
  const { productos, cargando, error: errorCarga, recargar } = useProductos()
  const [carrito, setCarrito] = useState<Carrito>({})
  const [cliente, setCliente] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [pagado, setPagado] = useState<boolean | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<{ numero: number; total: number; pagado: boolean; metodo: MetodoPago | null } | null>(null)
  const [recibido, setRecibido] = useState('') // con cuánto paga en efectivo (solo para calcular las vueltas)
  const [abierto, setAbierto] = useState(false) // panel de cobro en celular

  useEffect(() => {
    setCarrito((c) => ajustarCarrito(c, productos))
  }, [productos])

  const lineas = useMemo(() => lineasCarrito(carrito, productos), [productos, carrito])
  // Lo agotado no se muestra. Si las últimas unidades están en esta venta, el producto sigue visible (con "Quedan 0").
  const disponibles = productos.filter((p) => p.stock > 0)
  const total = lineas.reduce((s, l) => s + l.subtotal, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  useEffect(() => {
    if (unidades === 0) setAbierto(false)
  }, [unidades])

  const efectivo = metodo === 'efectivo' && pagado !== false && total > 0
  const monto = parseInt(recibido, 10) || 0
  const vueltas = monto - total

  // Qué falta para poder registrar (no asumimos que ya pagó)
  const falta =
    unidades === 0 ? 'Agrega productos' : pagado === null ? 'Indica si ya pagó' : pagado && !metodo ? 'Elige con qué pagó' : null

  async function registrar() {
    if (falta) return setError(falta + '.')
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_nombre: cliente.trim() || 'Venta en caja',
      p_telefono: null,
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      p_metodo_pago: metodo,
      p_pagado: pagado,
    })
    setEnviando(false)
    if (error) {
      const msg = mensajeError(error)
      setError(
        msg.toLowerCase().includes('stock')
          ? 'No alcanza el stock de algún producto. Ya actualizamos las cantidades.'
          : msg.toLowerCase().includes('jornada')
            ? 'La jornada de ventas se cerró, así que no se registró esta venta.'
            : msg,
      )
      recargar()
      return
    }
    const fila = Array.isArray(data) ? data[0] : data
    setUltima({ numero: fila.out_numero, total: Number(fila.out_total), pagado: !!pagado, metodo })
    setCarrito({})
    setCliente('')
    setMetodo(null)
    setPagado(null)
    setRecibido('')
    setAbierto(false)
  }

  const primerNombre = nombreCajero?.split(' ')[0]

  const cambiarCantidad = (l: (typeof lineas)[number], n: number) => setCarrito((c) => fijarCantidad(c, l.producto, n))

  const opcion = (on: boolean, color: 'ok' | 'warn' | 'primary') =>
    `rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
      on
        ? color === 'ok'
          ? 'border-ok bg-ok-bg text-ok ring-1 ring-ok'
          : color === 'warn'
            ? 'border-warn bg-warn-bg text-warn ring-1 ring-warn'
            : 'border-primary bg-[#E8EAFB] text-primary ring-1 ring-primary'
        : 'border-line bg-white text-ink'
    }`

  /** Todo lo de cobrar: cantidades, cliente, si pagó, método, con cuánto paga y registrar */
  const panel = (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Venta actual</SectionLabel>
        {unidades > 0 && (
          <button onClick={() => setCarrito({})} className="flex items-center gap-1 text-xs font-medium text-muted">
            <Trash2 size={14} /> Vaciar
          </button>
        )}
      </div>
      {lineas.length === 0 ? (
        <p className="text-sm text-muted">Usa + en un producto para agregarlo.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lineas.map((l) => (
            <li key={l.producto.id} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{l.producto.nombre}</p>
                <p className="text-xs text-muted tabular-nums">{precio(l.subtotal)}</p>
              </div>
              <Stepper valor={l.cantidad} max={l.producto.stock} onChange={(n) => cambiarCantidad(l, n)} />
            </li>
          ))}
        </ul>
      )}
      <input
        value={cliente}
        onChange={(e) => setCliente(e.target.value)}
        placeholder="Nombre del cliente (opcional)"
        className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-primary"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={opcion(pagado === true, 'ok')}
          onClick={() => {
            setPagado(true)
            setError(null)
          }}
        >
          Ya pagó
        </button>
        <button
          type="button"
          className={opcion(pagado === false, 'warn')}
          onClick={() => {
            setPagado(false)
            setError(null)
          }}
        >
          Paga después
        </button>
      </div>
      <div className="space-y-1.5">
        {pagado === false && <p className="text-xs text-muted">Método de pago (opcional)</p>}
        <SelectorMetodoPago
          valor={metodo}
          onChange={(m) => {
            setMetodo(m)
            setError(null)
          }}
        />
      </div>
      {metodo === 'transferencia' && <DatosTransferencia />}

      {efectivo && (
        <div className="space-y-2 rounded-xl bg-page p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative">
              <span className="sr-only">¿Con cuánto paga?</span>
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-muted">$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Paga con"
                value={monto ? monto.toLocaleString('es-CO') : ''}
                onChange={(e) => setRecibido(e.target.value.replace(/\D/g, '').slice(0, 9))}
                onFocus={(e) => e.target.select()}
                className="w-[104px] rounded-lg border border-line bg-white py-2 pl-6 pr-2 text-[14px] font-bold tabular-nums text-ink outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-primary"
              />
            </label>
            {[total, ...sugerencias(total)].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRecibido(String(m))}
                className={`rounded-lg border px-2.5 py-2 text-[13px] font-semibold tabular-nums transition ${
                  monto === m ? 'border-primary bg-[#E8EAFB] text-primary ring-1 ring-primary' : 'border-line bg-white text-ink'
                }`}
              >
                {m === total ? 'Exacto' : precio(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-[11px] text-muted">Total</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{precio(total)}</p>
        </div>
        {efectivo && monto > 0 && (
          <div className={`rounded-lg px-3 py-1 text-right ${vueltas >= 0 ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'}`}>
            <p className="text-[11px] font-medium">{vueltas >= 0 ? 'Vueltas' : 'Falta'}</p>
            <p className="text-2xl font-bold tabular-nums">{precio(Math.abs(vueltas))}</p>
          </div>
        )}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={registrar} disabled={enviando || unidades === 0} icon={Wallet}>
        {enviando ? 'Registrando…' : unidades > 0 && falta ? falta : 'Registrar venta'}
      </BotonPrincipal>
    </div>
  )

  return (
    <main className="relative mx-auto w-full max-w-[600px] px-4 pb-44 pt-5 lg:max-w-[1120px] lg:pb-28">
      <div className="mb-4 space-y-4">
        <div>
          <TituloPagina>Vender</TituloPagina>
          <p className="mt-1 text-sm text-muted">
            {primerNombre ? `Hola, ${primerNombre}. ` : ''}Usa + y − para armar la venta.
          </p>
        </div>
  
        {ultima && (
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${ultima.pagado ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'}`}>
            <CheckCircle2 size={22} className="shrink-0" />
            <p className="text-sm font-semibold">
              Venta {numeroPedido(ultima.numero)} registrada · {precio(ultima.total)}
              <span className="block font-medium">
                {ultima.pagado ? `Pagada con ${textoMetodo(ultima.metodo)}` : 'Queda pendiente de pago (en la pestaña Pedidos)'}
              </span>
            </p>
            <button onClick={() => setUltima(null)} className="ml-auto text-xs font-semibold underline">
              Ok
            </button>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <div className="space-y-4">
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <Aviso tipo="error">No pudimos cargar los productos: {errorCarga}</Aviso>
          ) : productos.length === 0 ? (
            <Card className="text-center text-sm text-muted">Aún no hay productos activos.</Card>
          ) : disponibles.length === 0 ? (
            <Card className="text-center text-sm text-muted">Se agotó todo. Si llegan más unidades, el admin las suma en Productos.</Card>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {disponibles.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  cantidad={carrito[p.id] ?? 0}
                  restarElegidos
                  onChange={(n) => {
                    setUltima(null)
                    setCarrito((c) => fijarCantidad(c, p, n))
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Computador: panel lateral que siempre se ve */}
        <aside className="hidden lg:sticky lg:top-[72px] lg:block">
          <div className="max-h-[calc(100dvh-72px-96px)] overflow-y-auto rounded-2xl border border-line bg-white p-4">{panel}</div>
        </aside>
      </div>

      {/* Celular: barra corta abajo; "Cobrar" abre el panel */}
      <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[600px] items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] text-muted">
              {unidades} {unidades === 1 ? 'producto' : 'productos'}
            </p>
            <p className="text-xl font-bold tabular-nums text-ink">{precio(total)}</p>
          </div>
          <BotonPrincipal onClick={() => setAbierto(true)} disabled={unidades === 0} icon={Wallet}>
            {unidades === 0 ? 'Agrega productos' : 'Cobrar'}
          </BotonPrincipal>
        </div>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Cobrar venta">
          <button className="absolute inset-0 bg-ink/40" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
            <div className="sticky top-0 z-10 -mx-4 mb-2 border-b border-line bg-white px-4 pb-2 pt-1">
              <span className="mx-auto mb-1.5 block h-1.5 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between">
                <p className="text-[17px] font-semibold">Cobrar venta</p>
                <button onClick={() => setAbierto(false)} className="-mr-1.5 rounded-full p-1.5 text-muted" aria-label="Cerrar">
                  <X size={22} />
                </button>
              </div>
            </div>
            <div className="mx-auto max-w-[600px]">{panel}</div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ================= Pedidos ================= */

type Filtro = 'por-cobrar' | 'por-entregar'

function PedidosOnline({
  pedidos,
  cargando,
  error,
  recargar,
  filtro,
  onFiltro: setFiltro,
}: ReturnType<typeof usePedidos> & { filtro: Filtro; onFiltro: (f: Filtro) => void }) {
  const [busqueda, setBusqueda] = useState('')

  // Por cobrar: todo lo que no se ha pagado (también lo entregado que debe el pago). Por entregar: online ya pagados.
  const porCobrar = pedidos.filter(debePago)
  const porEntregar = pedidos.filter((p) => p.estado === 'pagado' && p.canal === 'online')
  const conteo = { 'por-cobrar': porCobrar.length, 'por-entregar': porEntregar.length }

  const q = busqueda.trim().toLowerCase().replace(/^#/, '')
  const visibles = (filtro === 'por-cobrar' ? porCobrar : porEntregar)
    .filter((p) => !q || String(p.numero) === String(Number(q)) || p.nombre_cliente.toLowerCase().includes(q))
    .sort((a, b) => a.numero - b.numero)

  return (
    <Contenido className="space-y-4 pb-28 pt-5">
      <div>
        <TituloPagina>Pedidos</TituloPagina>
        <p className="mt-1 text-sm text-muted">Se actualizan solos cuando llega uno nuevo.</p>
      </div>

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número o nombre"
          inputMode="search"
          className="w-full rounded-lg border border-line bg-white py-3 pl-10 pr-3.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 ring-1 ring-line">
        {(
          [
            ['por-cobrar', 'Por cobrar'],
            ['por-entregar', 'Por entregar'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${filtro === id ? 'bg-primary text-white' : 'text-muted'}`}
          >
            {texto} ({conteo[id]})
          </button>
        ))}
      </div>

      {cargando ? (
        <Cargando />
      ) : error ? (
        <Aviso tipo="error">No pudimos cargar los pedidos: {error}</Aviso>
      ) : visibles.length === 0 ? (
        <Card className="text-center">
          <p className="text-[15px] font-semibold">{q ? 'No encontramos ese pedido' : 'Todo al día'}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? 'Revisa el número o el nombre.' : filtro === 'por-cobrar' ? 'No hay pedidos por cobrar.' : 'No hay pedidos por entregar.'}
          </p>
        </Card>
      ) : (
        visibles.map((p) => <PedidoCard key={p.id} pedido={p} acciones={<AccionesPago pedido={p} onHecho={recargar} />} />)
      )}
    </Contenido>
  )
}
