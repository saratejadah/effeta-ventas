const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** $12.000 */
export function precio(valor: number | string): string {
  return cop.format(Number(valor)).replace(/\s/g, '')
}

/** #0012 */
export function numeroPedido(n: number): string {
  return '#' + String(n).padStart(4, '0')
}

export function hora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

/** Convierte los errores de Supabase/Postgres en un mensaje para mostrar */
export function mensajeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'Algo salió mal. Intenta de nuevo.'
}
