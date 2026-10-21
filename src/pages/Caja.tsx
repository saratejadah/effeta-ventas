import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, PackageCheck, Search, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePedidos, useProductos } from '../lib/hooks'
import { ajustarCarrito, fijarCantidad, lineasCarrito } from '../lib/carrito'
import { mensajeError, numeroPedido, precio } from '../lib/format'
import type { Carrito, Estado, Pedido } from '../lib/types'
import { PedidoCard } from '../components/PedidoCard'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  BottomNav,
  Campo,
  Card,
  Cargando,
  Contenido,
  Header,
  SectionLabel,
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

  return (
    <div className="min-h-dvh">
      <Header nombre={perfil?.nombre} onSalir={salir} />
      {pestana === 'vender' ? <Vender nombreCajero={perfil?.nombre} /> : <PedidosOnline />}
      <BottomNav tabs={tabs} activo={pestana} onChange={setPestana} />
    </div>
  )
}

/* ================= Vender ================= */

function Vender({ nombreCajero }: { nombreCajero?: string }) {
  const { productos, cargando, error: errorCarga, recargar } = useProductos()
  const [carrito, setCarrito] = useState<Carrito>({})
  const [cliente, setCliente] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<{ numero: number; total: number } | null>(null)

  useEffect(() => {
    setCarrito((c) => ajustarCarrito(c, productos))
  }, [productos])

  const lineas = useMemo(() => lineasCarrito(carrito, productos), [productos, carrito])
  const total = lineas.reduce((s, l) => s + l.subtotal, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  async function registrar() {
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_nombre: cliente.trim() || 'Venta en caja',
      p_telefono: null,
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    })
    setEnviando(false)
    if (error) {
      const msg = mensajeError(error)
      setError(msg.toLowerCase().includes('stock') ? 'No alcanza el stock de algún producto. Ya actualizamos las cantidades.' : msg)
      recargar()
      return
    }
    const fila = Array.isArray(data) ? data[0] : data
    setUltima({ numero: fila.out_numero, total: Number(fila.out_total) })
    setCarrito({})
    setCliente('')
  }

  const primerNombre = nombreCajero?.split(' ')[0]

  return (
    <Contenido className="space-y-4 pb-44 pt-5">
      <div>
        <TituloPagina>Vender</TituloPagina>
        <p className="mt-1 text-sm text-muted">
          {primerNombre ? `Hola, ${primerNombre}. ` : ''}Toca un producto para sumarlo a la venta.
        </p>
      </div>

      {ultima && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok-bg px-4 py-3 text-ok">
          <CheckCircle2 size={22} className="shrink-0" />
          <p className="text-sm font-semibold">
            Venta {numeroPedido(ultima.numero)} registrada · {precio(ultima.total)}
          </p>
          <button onClick={() => setUltima(null)} className="ml-auto text-xs font-semibold underline">
            Ok
          </button>
        </div>
      )}

      {cargando ? (
        <Cargando />
      ) : errorCarga ? (
        <Aviso tipo="error">No pudimos cargar los productos: {errorCarga}</Aviso>
      ) : productos.length === 0 ? (
        <Card className="text-center text-sm text-muted">Aún no hay productos activos.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {productos.map((p) => {
            const enCarrito = carrito[p.id] ?? 0
            const agotado = p.stock <= 0
            const lleno = enCarrito >= p.stock
            return (
              <button
                key={p.id}
                disabled={agotado || lleno}
                onClick={() => {
                  setUltima(null)
                  setCarrito((c) => fijarCantidad(c, p, enCarrito + 1))
                }}
                className={`relative flex min-h-[112px] flex-col rounded-2xl border bg-white p-3 text-left transition active:scale-[0.97] disabled:active:scale-100 ${
                  enCarrito > 0 ? 'border-primary ring-1 ring-primary' : 'border-line'
                } ${agotado ? 'opacity-50' : ''}`}
              >
                {enCarrito > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-sm font-bold text-white">
                    {enCarrito}
                  </span>
                )}
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{p.nombre}</span>
                <span className="mt-auto pt-2 text-lg font-bold tabular-nums">{precio(p.precio)}</span>
                <span className={`text-xs font-medium ${agotado ? 'text-muted' : p.stock <= 3 ? 'text-warn' : 'text-ok'}`}>
                  {agotado ? 'Agotado' : `Quedan ${p.stock - enCarrito}`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Venta actual</SectionLabel>
          {unidades > 0 && (
            <button onClick={() => setCarrito({})} className="flex items-center gap-1 text-xs font-medium text-muted">
              <Trash2 size={14} /> Vaciar
            </button>
          )}
        </div>
        {lineas.length === 0 ? (
          <p className="text-sm text-muted">Todavía no has agregado productos.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lineas.map((l) => (
              <li key={l.producto.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{l.producto.nombre}</p>
                  <p className="text-[13px] text-muted tabular-nums">{precio(l.subtotal)}</p>
                </div>
                <Stepper valor={l.cantidad} max={l.producto.stock} onChange={(n) => setCarrito((c) => fijarCantidad(c, l.producto, n))} />
              </li>
            ))}
          </ul>
        )}
        <Campo
          label="Nombre del cliente (opcional)"
          placeholder="Venta en caja"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
      </Card>

      <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[600px] items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] text-muted">Total</p>
            <p className="text-xl font-bold tabular-nums text-ink">{precio(total)}</p>
          </div>
          <BotonPrincipal onClick={registrar} disabled={enviando || unidades === 0} icon={Wallet}>
            {enviando ? 'Registrando…' : 'Registrar venta'}
          </BotonPrincipal>
        </div>
      </div>
    </Contenido>
  )
}

/* ================= Pedidos online ================= */

type Filtro = 'pendiente' | 'pagado'

export function PedidosOnline() {
  const { pedidos, cargando, error, recargar } = usePedidos()
  const [filtro, setFiltro] = useState<Filtro>('pendiente')
  const [busqueda, setBusqueda] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const online = pedidos.filter((p) => p.canal === 'online')
  const conteo = {
    pendiente: online.filter((p) => p.estado === 'pendiente').length,
    pagado: online.filter((p) => p.estado === 'pagado').length,
  }

  const q = busqueda.trim().toLowerCase().replace(/^#/, '')
  const visibles = online
    .filter((p) => p.estado === filtro)
    .filter((p) => !q || String(p.numero) === String(Number(q)) || p.nombre_cliente.toLowerCase().includes(q))
    .sort((a, b) => a.numero - b.numero)

  async function cambiarEstado(p: Pedido, estado: Estado) {
    setOcupado(p.id)
    setErrorAccion(null)
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', p.id)
    setOcupado(null)
    if (error) setErrorAccion(mensajeError(error))
    else recargar()
  }

  return (
    <Contenido className="space-y-4 pb-28 pt-5">
      <div>
        <TituloPagina>Pedidos online</TituloPagina>
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
            ['pendiente', 'Por cobrar'],
            ['pagado', 'Por entregar'],
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

      {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}

      {cargando ? (
        <Cargando />
      ) : error ? (
        <Aviso tipo="error">No pudimos cargar los pedidos: {error}</Aviso>
      ) : visibles.length === 0 ? (
        <Card className="text-center">
          <p className="text-[15px] font-semibold">{q ? 'No encontramos ese pedido' : 'Todo al día'}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? 'Revisa el número o el nombre.' : filtro === 'pendiente' ? 'No hay pedidos por cobrar.' : 'No hay pedidos por entregar.'}
          </p>
        </Card>
      ) : (
        visibles.map((p) => (
          <PedidoCard
            key={p.id}
            pedido={p}
            acciones={
              <>
                {p.estado === 'pendiente' && (
                  <BotonPrincipal className="py-2.5 text-sm" icon={Wallet} disabled={ocupado === p.id} onClick={() => cambiarEstado(p, 'pagado')}>
                    Marcar pagado
                  </BotonPrincipal>
                )}
                <BotonSecundario
                  className={p.estado === 'pendiente' ? 'shrink-0' : 'w-full'}
                  icon={PackageCheck}
                  disabled={ocupado === p.id}
                  onClick={() => cambiarEstado(p, 'entregado')}
                >
                  Entregado
                </BotonSecundario>
              </>
            }
          />
        ))
      )}
    </Contenido>
  )
}
