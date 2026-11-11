import { useState } from 'react'
import { PackageCheck, Undo2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/format'
import type { Estado, MetodoPago, Pedido } from '../lib/types'
import { Aviso, BotonPrincipal, BotonSecundario, SelectorMetodoPago } from './ui'
import { CalculadoraVueltas } from './Vueltas'

type Cambios = { estado?: Estado; metodo_pago?: MetodoPago; pago_pendiente?: boolean }

/** El pedido todavía no se ha pagado (aunque ya se haya entregado) */
export function debePago(p: Pedido): boolean {
  return p.estado === 'pendiente' || (p.estado === 'entregado' && !!p.pago_pendiente)
}

/**
 * Botones para cobrar y entregar un pedido.
 * - Pendiente: "Marcar pagado" o "Entregado" (que pregunta si ya pagó).
 * - Entregado sin pagar: "Marcar pagado" (queda entregado y pagado).
 * Al marcar pagado se elige con qué se pagó (viene preseleccionado lo que escogió el cliente).
 */
export function AccionesPago({ pedido: p, onHecho }: { pedido: Pedido; onHecho: () => void }) {
  // 'pagar' = elegir método para marcar pagado; 'entregar' = preguntar si ya pagó; 'entregar-pagado' = elegir método y entregar
  const [paso, setPaso] = useState<null | 'pagar' | 'entregar' | 'entregar-pagado'>(null)
  const [metodo, setMetodo] = useState<MetodoPago | null>(p.metodo_pago)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debeEntregado = p.estado === 'entregado' && !!p.pago_pendiente

  async function actualizar(cambios: Cambios) {
    setOcupado(true)
    setError(null)
    const { error } = await supabase.from('pedidos').update(cambios).eq('id', p.id)
    setOcupado(false)
    if (error) setError(mensajeError(error))
    else {
      setPaso(null)
      onHecho()
    }
  }

  const cancelar = (
    <BotonSecundario className="shrink-0" disabled={ocupado} onClick={() => setPaso(null)}>
      Cancelar
    </BotonSecundario>
  )

  /** Elegir con qué pagó y confirmar */
  const elegirMetodo = (titulo: string, textoBoton: string, cambios: Cambios) => (
    <div className="w-full space-y-3">
      <p className="text-sm font-semibold">{titulo}</p>
      <SelectorMetodoPago valor={metodo} onChange={setMetodo} />
      {metodo === 'efectivo' && <CalculadoraVueltas total={p.total} />}
      <div className="flex gap-2">
        <BotonPrincipal
          className="py-2.5 text-sm"
          icon={Wallet}
          disabled={!metodo || ocupado}
          onClick={() => metodo && actualizar({ ...cambios, metodo_pago: metodo, pago_pendiente: false })}
        >
          {textoBoton}
        </BotonPrincipal>
        {cancelar}
      </div>
    </div>
  )

  let botones = null
  if (paso === 'pagar') {
    botones = elegirMetodo(
      '¿Con qué pagó?',
      'Confirmar pago',
      debeEntregado ? { estado: 'entregado' } : { estado: 'pagado' },
    )
  } else if (paso === 'entregar-pagado') {
    botones = elegirMetodo('¿Con qué pagó?', 'Pagado y entregado', { estado: 'entregado' })
  } else if (paso === 'entregar') {
    botones = (
      <div className="w-full space-y-3">
        <p className="text-sm font-semibold">¿Ya pagó?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setPaso('entregar-pagado')}
            className="rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold text-ok disabled:opacity-40"
          >
            Sí, ya pagó
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => actualizar({ estado: 'entregado', pago_pendiente: true })}
            className="rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold text-warn disabled:opacity-40"
          >
            No, debe el pago
          </button>
        </div>
        <div className="flex">{cancelar}</div>
      </div>
    )
  } else if (p.estado === 'pendiente') {
    botones = (
      <>
        <BotonPrincipal className="py-2.5 text-sm" icon={Wallet} onClick={() => setPaso('pagar')}>
          Marcar pagado
        </BotonPrincipal>
        <BotonSecundario className="shrink-0" icon={PackageCheck} onClick={() => setPaso('entregar')}>
          Entregado
        </BotonSecundario>
      </>
    )
  } else if (debeEntregado) {
    botones = (
      <>
        <BotonPrincipal className="py-2.5 text-sm" icon={Wallet} onClick={() => setPaso('pagar')}>
          Marcar pagado
        </BotonPrincipal>
        <BotonSecundario
          className="shrink-0"
          icon={Undo2}
          disabled={ocupado}
          onClick={() => actualizar({ estado: 'pendiente', pago_pendiente: false })}
        >
          No entregado
        </BotonSecundario>
      </>
    )
  } else if (p.estado === 'pagado') {
    botones = (
      <>
        <BotonPrincipal className="py-2.5 text-sm" icon={PackageCheck} disabled={ocupado} onClick={() => actualizar({ estado: 'entregado' })}>
          Entregado
        </BotonPrincipal>
        <BotonSecundario className="shrink-0" icon={Undo2} disabled={ocupado} onClick={() => actualizar({ estado: 'pendiente' })}>
          No pagado
        </BotonSecundario>
      </>
    )
  } else if (p.estado === 'entregado') {
    botones = (
      <BotonSecundario className="w-full" icon={Undo2} disabled={ocupado} onClick={() => actualizar({ estado: 'pagado' })}>
        Marcar como no entregado
      </BotonSecundario>
    )
  }

  if (!botones) return null
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">{botones}</div>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  )
}
