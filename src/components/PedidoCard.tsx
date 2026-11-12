import type { ReactNode } from 'react'
import { Store } from 'lucide-react'
import { hora, nombreItem, numeroPedido, precio } from '../lib/format'
import { textoMetodo } from '../lib/pago'
import type { Pedido } from '../lib/types'
import { DistanciaPill, EstadoPill } from './ui'
import { RecogidaPill } from './RecogidaPill'
import { useAhora } from '../lib/recogida'

/** Tarjeta de un pedido con su detalle. `acciones` se pinta abajo (botones). */
export function PedidoCard({ pedido: p, acciones, mostrarCajero }: { pedido: Pedido; acciones?: ReactNode; mostrarCajero?: boolean }) {
  const ahora = useAhora()
  return (
    <div className={`rounded-2xl border border-line bg-white p-4 ${p.canal === 'online' ? 'border-l-4 border-l-[#7A3FB0]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-2xl font-bold leading-none text-primary">{numeroPedido(p.numero)}</p>
          <p className="mt-1.5 truncate text-[15px] font-semibold">{p.nombre_cliente}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            {p.canal === 'presencial' && (
              <span className="inline-flex items-center gap-1">
                <Store size={12} />
                En caja ·
              </span>
            )}
            <span>{hora(p.created_at)}</span>
            {p.telefono && <span>· {p.telefono}</span>}
            {mostrarCajero && p.perfiles?.nombre && <span>· {p.perfiles.nombre}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <EstadoPill estado={p.estado} debe={p.pago_pendiente} />
          {p.canal === 'online' && <DistanciaPill />}
          <RecogidaPill pedido={p} ahora={ahora} />
        </div>
      </div>

      {p.pedido_items && p.pedido_items.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {p.pedido_items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="font-semibold">{i.cantidad}×</span> {nombreItem(i)}
              </span>
              <span className="tabular-nums text-muted">{precio(i.precio_unitario * i.cantidad)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-muted">
          Total ·{' '}
          <span className="font-medium text-ink">
            {(p.estado === 'pendiente' || p.pago_pendiente) && p.metodo_pago ? `Pagará con ${textoMetodo(p.metodo_pago)}` : textoMetodo(p.metodo_pago)}
          </span>
        </span>
        <span className="text-lg font-bold tabular-nums text-accent">{precio(p.total)}</span>
      </div>

      {acciones && <div className="mt-3 flex gap-2">{acciones}</div>}
    </div>
  )
}
