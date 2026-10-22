import { Banknote, Landmark, type LucideIcon } from 'lucide-react'
import type { MetodoPago } from './types'

export const METODOS_PAGO: { id: MetodoPago; texto: string; icon: LucideIcon }[] = [
  { id: 'efectivo', texto: 'Efectivo', icon: Banknote },
  { id: 'transferencia', texto: 'Transferencia', icon: Landmark },
]

/** Número para recibir transferencias (Nequi, Daviplata o llave) */
export const NUMERO_TRANSFERENCIA = '3246872564'

export function textoMetodo(m: MetodoPago | null | undefined): string {
  return METODOS_PAGO.find((x) => x.id === m)?.texto ?? 'Sin método'
}
