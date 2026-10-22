import { Banknote, Landmark, Smartphone, type LucideIcon } from 'lucide-react'
import type { MetodoPago } from './types'

export const METODOS_PAGO: { id: MetodoPago; texto: string; icon: LucideIcon }[] = [
  { id: 'efectivo', texto: 'Efectivo', icon: Banknote },
  { id: 'nequi', texto: 'Nequi', icon: Smartphone },
  { id: 'daviplata', texto: 'Daviplata', icon: Smartphone },
  { id: 'transferencia', texto: 'Transferencia', icon: Landmark },
]

export function textoMetodo(m: MetodoPago | null | undefined): string {
  return METODOS_PAGO.find((x) => x.id === m)?.texto ?? 'Sin método'
}
