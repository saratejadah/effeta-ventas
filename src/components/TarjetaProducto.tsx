import { ImageOff } from 'lucide-react'
import { precio } from '../lib/format'
import type { Producto } from '../lib/types'
import { Stepper, StockPill } from './ui'

/**
 * Tarjeta de producto con foto, precio, "Quedan X" y botones − / +.
 * Se usa en el link de pedidos y en la caja.
 * `restarElegidos`: "Quedan" descuenta lo que ya está en la venta (útil en la caja).
 */
export function TarjetaProducto({
  producto: p,
  cantidad,
  onChange,
  restarElegidos,
}: {
  producto: Producto
  cantidad: number
  onChange: (n: number) => void
  restarElegidos?: boolean
}) {
  const agotado = p.stock <= 0
  return (
    <div
      className={`flex gap-4 rounded-2xl border bg-white p-3 transition ${cantidad > 0 ? 'border-primary ring-1 ring-primary' : 'border-line'} ${
        agotado ? 'opacity-60' : ''
      }`}
    >
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
          <StockPill stock={restarElegidos ? p.stock - cantidad : p.stock} />
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
