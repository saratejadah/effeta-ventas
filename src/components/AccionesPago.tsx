import { useState } from 'react'
import { PackageCheck, Undo2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/format'
import type { Estado, MetodoPago, Pedido } from '../lib/types'
import { Aviso, BotonPrincipal, BotonSecundario, SelectorMetodoPago } from './ui'

/**
 * Botones para cobrar un pedido: al marcarlo pagado se elige con qué se pagó
 * (viene preseleccionado lo que escogió el cliente). También permite deshacer.
 */
export function AccionesPago({ pedido: p, onHecho }: { pedido: Pedido; onHecho: () => void }) {
  const [eligiendo, setEligiendo] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPago | null>(p.metodo_pago)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function actualizar(cambios: { estado: Estado; metodo_pago?: MetodoPago }) {
    setOcupado(true)
    setError(null)
    const { error } = await supabase.from('pedidos').update(cambios).eq('id', p.id)
    setOcupado(false)
    if (error) setError(mensajeError(error))
    else {
      setEligiendo(false)
      onHecho()
    }
  }

  let botones = null
  if (p.estado === 'pendiente' && eligiendo) {
    botones = (
      <div className="w-full space-y-3">
        <p className="text-sm font-semibold">¿Con qué pagó?</p>
        <SelectorMetodoPago valor={metodo} onChange={setMetodo} />
        <div className="flex gap-2">
          <BotonPrincipal
            className="py-2.5 text-sm"
            icon={Wallet}
            disabled={!metodo || ocupado}
            onClick={() => metodo && actualizar({ estado: 'pagado', metodo_pago: metodo })}
          >
            Confirmar pago
          </BotonPrincipal>
          <BotonSecundario className="shrink-0" onClick={() => setEligiendo(false)}>
            Cancelar
          </BotonSecundario>
        </div>
      </div>
    )
  } else if (p.estado === 'pendiente') {
    botones = (
      <BotonPrincipal className="py-2.5 text-sm" icon={Wallet} onClick={() => setEligiendo(true)}>
        Marcar pagado
      </BotonPrincipal>
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
