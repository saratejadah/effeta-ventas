import { Clock } from 'lucide-react'
import type { Pedido } from '../lib/types'
import { estadoRecogida, limiteRecogida, textoHora } from '../lib/recogida'

const estilos = {
  luego: 'bg-[#E8EAFB] text-primary',
  pronto: 'bg-[#E8EAFB] text-primary ring-1 ring-primary',
  ahora: 'bg-warn-bg text-warn ring-1 ring-warn',
  vencido: 'bg-[#FDECEC] text-danger',
}

/** Hora de recogida de un pedido del link, con su urgencia. No se muestra si ya se entregó o se canceló. */
export function RecogidaPill({ pedido: p, ahora }: { pedido: Pedido; ahora: number }) {
  if (!p.hora_recogida || p.estado === 'entregado' || p.estado === 'cancelado') return null
  const e = estadoRecogida(p.hora_recogida, ahora)
  const h = textoHora(p.hora_recogida, ahora)
  const texto =
    e === 'vencido'
      ? `Venció · ${textoHora(limiteRecogida(p.hora_recogida), ahora)}`
      : e === 'ahora'
        ? `Recoger ya · hasta ${textoHora(limiteRecogida(p.hora_recogida), ahora)}`
        : e === 'pronto'
          ? `Recoge en ${Math.max(1, Math.ceil((new Date(p.hora_recogida).getTime() - ahora) / 60000))} min · ${h}`
          : `Recoge ${h}`
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos[e]}`}>
      <Clock size={12} strokeWidth={2.2} />
      {texto}
    </span>
  )
}
