import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Pedido, Producto } from './types'

let canalId = 0

/**
 * Escucha cambios de una tabla en tiempo real y llama a `alCambiar`.
 * Devuelve nada; se limpia sola al desmontar.
 */
export function useTiempoReal(tabla: 'productos' | 'pedidos', alCambiar: () => void) {
  const ref = useRef(alCambiar)
  ref.current = alCambiar

  useEffect(() => {
    const canal = supabase
      .channel(`${tabla}-${++canalId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => ref.current())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [tabla])
}

/** Productos con stock en vivo. `todos` incluye los inactivos (solo admin). */
export function useProductos(todos = false) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    let q = supabase.from('productos').select('*').order('nombre')
    if (!todos) q = q.eq('activo', true)
    const { data, error } = await q
    if (error) setError(error.message)
    else {
      setError(null)
      setProductos((data ?? []).map((p) => ({ ...p, precio: Number(p.precio) })))
    }
    setCargando(false)
  }, [todos])

  useEffect(() => {
    recargar()
  }, [recargar])

  useTiempoReal('productos', recargar)

  return { productos, cargando, error, recargar }
}

const SELECT_PEDIDO = '*, perfiles(nombre), pedido_items(*, productos(nombre))'

/** Pedidos con sus items, en vivo. Solo para cajeros y admin. */
export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select(SELECT_PEDIDO)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) setError(error.message)
    else {
      setError(null)
      setPedidos(
        ((data ?? []) as Pedido[]).map((p) => ({
          ...p,
          total: Number(p.total),
          pedido_items: p.pedido_items?.map((i) => ({ ...i, precio_unitario: Number(i.precio_unitario) })),
        })),
      )
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  useTiempoReal('pedidos', recargar)

  return { pedidos, cargando, error, recargar }
}
