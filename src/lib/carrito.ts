import type { Carrito, Producto } from './types'

/** Recorta el carrito al stock disponible (por si alguien más compró). Devuelve el mismo objeto si no cambió nada. */
export function ajustarCarrito(carrito: Carrito, productos: Producto[]): Carrito {
  let cambio = false
  const nuevo: Carrito = {}
  for (const [id, cant] of Object.entries(carrito)) {
    const p = productos.find((x) => x.id === id)
    const n = Math.min(cant, p ? p.stock : 0)
    if (n !== cant) cambio = true
    if (n > 0) nuevo[id] = n
  }
  return cambio ? nuevo : carrito
}

export function lineasCarrito(carrito: Carrito, productos: Producto[]) {
  return productos
    .filter((p) => carrito[p.id])
    .map((p) => ({ producto: p, cantidad: carrito[p.id], subtotal: p.precio * carrito[p.id] }))
}

export function fijarCantidad(carrito: Carrito, p: Producto, n: number): Carrito {
  const nuevo = { ...carrito }
  if (n <= 0) delete nuevo[p.id]
  else nuevo[p.id] = Math.min(n, p.stock)
  return nuevo
}
