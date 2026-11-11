import { useState } from 'react'
import { ChevronDown, Globe, Store, Trash2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePedidos } from '../../lib/hooks'
import { hora, mensajeError, numeroPedido, precio } from '../../lib/format'
import type { Canal, Estado, Pedido } from '../../lib/types'
import { PedidoCard } from '../../components/PedidoCard'
import { AccionesPago, debePago } from '../../components/AccionesPago'
import { SelectorJornada, type VistaJornada } from '../../components/Jornadas'
import { Aviso, BotonSecundario, Card, Cargando, Chip, Contenido, EstadoPill, TituloPagina } from '../../components/ui'

type FiltroEstado = Estado | 'todos' | 'sin-entregar'

const estados: { id: FiltroEstado; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'sin-entregar', texto: 'Sin entregar' },
  { id: 'pendiente', texto: 'Por cobrar' },
  { id: 'pagado', texto: 'Pagados' },
  { id: 'entregado', texto: 'Entregados' },
  { id: 'cancelado', texto: 'Cancelados' },
]

const canales: { id: Canal | 'todos'; texto: string }[] = [
  { id: 'todos', texto: 'Todos los canales' },
  { id: 'online', texto: 'A distancia' },
  { id: 'presencial', texto: 'En caja' },
]

export default function Pedidos({ jornadas, jornada, onElegir }: VistaJornada) {
  const { pedidos, cargando, error, recargar } = usePedidos(jornada.id)
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [canal, setCanal] = useState<Canal | 'todos'>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const sinEntregar = (p: Pedido) => p.estado === 'pendiente' || p.estado === 'pagado'
  const visibles = pedidos.filter(
    (p) =>
      (estado === 'todos' ||
        (estado === 'sin-entregar' ? sinEntregar(p) : estado === 'pendiente' ? debePago(p) : p.estado === estado)) &&
      (canal === 'todos' || p.canal === canal),
  )
  // Pedidos del link que todavía no se han entregado (la persona no está en la caja: fácil olvidarlos)
  const distancia = pedidos.filter((p) => p.canal === 'online' && sinEntregar(p)).length
  const viendoDistancia = estado === 'sin-entregar' && canal === 'online'

  async function cancelar(p: Pedido) {
    const unidades = jornada.abierta
      ? 'Las unidades vuelven al inventario.'
      : 'Como esta jornada ya se cerró, las unidades no vuelven al inventario.'
    if (!window.confirm(`¿Cancelar el pedido ${numeroPedido(p.numero)} de ${p.nombre_cliente}? ${unidades}`)) return
    setCancelando(p.id)
    setErrorAccion(null)
    const { error } = await supabase.rpc('cancelar_pedido', { p_pedido_id: p.id })
    setCancelando(null)
    if (error) setErrorAccion(mensajeError(error))
    else recargar()
  }

  async function eliminar(p: Pedido) {
    const aviso =
      p.estado === 'cancelado'
        ? `¿Eliminar para siempre el pedido ${numeroPedido(p.numero)} de ${p.nombre_cliente}? Desaparece de los registros y no se puede deshacer.`
        : jornada.abierta
          ? `¿Eliminar para siempre el pedido ${numeroPedido(p.numero)} de ${p.nombre_cliente}? Las unidades vuelven al inventario, el pedido desaparece de los registros y no se puede deshacer.`
          : `¿Eliminar para siempre el pedido ${numeroPedido(p.numero)} de ${p.nombre_cliente}? Desaparece de los registros y no se puede deshacer. (Como esta jornada ya se cerró, las unidades no vuelven al inventario.)`
    if (!window.confirm(aviso)) return
    setCancelando(p.id)
    setErrorAccion(null)
    const { error } = await supabase.rpc('eliminar_pedido', { p_pedido_id: p.id })
    setCancelando(null)
    if (error) setErrorAccion(mensajeError(error))
    else {
      setAbierto(null)
      recargar()
    }
  }

  return (
    <Contenido className="space-y-4 pt-5">
      <div>
        <TituloPagina>Pedidos</TituloPagina>
        <p className="mt-1 text-sm text-muted">Todos los pedidos de la jornada, en vivo. Toca uno para ver el detalle.</p>
      </div>

      <SelectorJornada jornadas={jornadas} actual={jornada} onElegir={onElegir} />

      {distancia > 0 && !viendoDistancia && (
        <button
          onClick={() => {
            setEstado('sin-entregar')
            setCanal('online')
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#7A3FB0]/30 bg-[#F1E8FB] px-4 py-3 text-left text-[#7A3FB0]"
        >
          <Globe size={22} className="shrink-0" />
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {distancia === 1 ? 'Hay 1 pedido a distancia sin entregar' : `Hay ${distancia} pedidos a distancia sin entregar`}
            <span className="block font-medium">Asegúrate de separarlos para que no se vendan en la caja.</span>
          </span>
          <span className="shrink-0 text-xs font-semibold underline">Ver</span>
        </button>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {estados.map((e) => (
          <Chip key={e.id} activo={estado === e.id} onClick={() => setEstado(e.id)}>
            {e.texto}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {canales.map((c) => (
          <Chip key={c.id} activo={canal === c.id} onClick={() => setCanal(c.id)}>
            {c.texto}
          </Chip>
        ))}
      </div>

      {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}

      {cargando ? (
        <Cargando />
      ) : error ? (
        <Aviso tipo="error">No pudimos cargar los pedidos: {error}</Aviso>
      ) : visibles.length === 0 ? (
        <Card className="text-center text-sm text-muted">No hay pedidos con estos filtros.</Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="grid grid-cols-[56px_1fr_auto] gap-3 border-b border-line bg-page/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span>N.º</span>
            <span>Cliente</span>
            <span className="text-right">Total</span>
          </div>
          <ul className="divide-y divide-line">
            {visibles.map((p) => {
              const open = abierto === p.id
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setAbierto(open ? null : p.id)}
                    className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 text-left active:bg-page"
                  >
                    <span className="font-serif text-[15px] font-bold text-primary">{numeroPedido(p.numero)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.nombre_cliente}</span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-muted">
                        {p.canal === 'online' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#7A3FB0]">
                            <Globe size={11} strokeWidth={2.2} />A distancia
                          </span>
                        ) : (
                          <>
                            <Store size={11} />
                            {p.perfiles?.nombre ?? 'Caja'}
                          </>
                        )}{' '}
                        · {hora(p.created_at)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums">{precio(p.total)}</span>
                      <span className="flex items-center gap-1">
                        <EstadoPill estado={p.estado} debe={p.pago_pendiente} />
                        <ChevronDown size={14} className={`text-muted transition ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="bg-page px-3 pb-3 pt-1">
                      <PedidoCard
                        pedido={p}
                        mostrarCajero
                        acciones={
                          <div className="w-full space-y-2">
                            {p.estado !== 'cancelado' && (
                              <>
                                <AccionesPago pedido={p} onHecho={recargar} />
                                <BotonSecundario
                                  className="w-full text-warn"
                                  icon={XCircle}
                                  disabled={cancelando === p.id}
                                  onClick={() => cancelar(p)}
                                >
                                  Cancelar pedido
                                </BotonSecundario>
                              </>
                            )}
                            <BotonSecundario
                              className="w-full text-danger"
                              icon={Trash2}
                              disabled={cancelando === p.id}
                              onClick={() => eliminar(p)}
                            >
                              Eliminar pedido
                            </BotonSecundario>
                          </div>
                        }
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Contenido>
  )
}
