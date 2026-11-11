import { useState } from 'react'
import { precio } from '../lib/format'

const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000]

/** Montos con los que probablemente pague: el total redondeado hacia arriba a cada billete */
export function sugerencias(total: number): number[] {
  const montos = new Set<number>()
  for (const b of BILLETES) {
    const m = Math.ceil(total / b) * b
    if (m > total) montos.add(m)
  }
  return [...montos].sort((a, b) => a - b).slice(0, 4)
}

/**
 * Calculadora de vueltas para pagos en efectivo: se escribe (o se toca) con cuánto paga
 * el cliente y muestra cuánto hay que devolverle. Solo ayuda a la caja, no se guarda.
 */
export function CalculadoraVueltas({ total }: { total: number }) {
  const [recibido, setRecibido] = useState('')
  const monto = parseInt(recibido, 10) || 0
  const vueltas = monto - total

  if (total <= 0) return null

  const boton = (activo: boolean) =>
    `rounded-lg border px-3 py-2 text-[13px] font-semibold tabular-nums transition ${
      activo ? 'border-primary bg-[#E8EAFB] text-primary ring-1 ring-primary' : 'border-line bg-white text-ink active:bg-page'
    }`

  return (
    <div className="space-y-2 rounded-xl bg-page p-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-muted">¿Con cuánto paga?</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-muted">$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={total.toLocaleString('es-CO')}
            value={monto ? monto.toLocaleString('es-CO') : ''}
            onChange={(e) => setRecibido(e.target.value.replace(/\D/g, '').slice(0, 9))}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-line bg-white py-3 pl-8 pr-3.5 text-lg font-bold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-muted/50 focus:border-primary"
          />
        </div>
      </label>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={boton(monto === total)} onClick={() => setRecibido(String(total))}>
          Exacto
        </button>
        {sugerencias(total).map((m) => (
          <button key={m} type="button" className={boton(monto === m)} onClick={() => setRecibido(String(m))}>
            {precio(m)}
          </button>
        ))}
      </div>

      {monto > 0 &&
        (vueltas >= 0 ? (
          <div className="flex items-baseline justify-between rounded-lg bg-ok-bg px-4 py-3 text-ok">
            <span className="text-sm font-semibold">{vueltas === 0 ? 'Pago exacto, sin vueltas' : 'Dar de vueltas'}</span>
            {vueltas > 0 && <span className="text-2xl font-bold tabular-nums">{precio(vueltas)}</span>}
          </div>
        ) : (
          <div className="flex items-baseline justify-between rounded-lg bg-warn-bg px-4 py-3 text-warn">
            <span className="text-sm font-semibold">Le falta pagar</span>
            <span className="text-2xl font-bold tabular-nums">{precio(-vueltas)}</span>
          </div>
        ))}
    </div>
  )
}
