import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Jornada, Pedido, Producto } from './types'

let canalId = 0

/**
 * Escucha cambios de una tabla en tiempo real y llama a `alCambiar`.
 * Devuelve nada; se limpia sola al desmontar.
 */
export function useTiempoReal(tabla: 'productos' | 'pedidos' | 'jornadas', alCambiar: () => void) {
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

/** Jornadas de venta, la más reciente primero, en vivo. `abierta` es la que está vendiendo (o null si están en pausa). */
export function useJornadas() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    const { data, error } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError(null)
      setJornadas(data ?? [])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  useTiempoReal('jornadas', recargar)

  const abierta = jornadas.find((j) => j.abierta) ?? null
  return { jornadas, abierta, cargando, error, recargar }
}

/**
 * Pedidos de una jornada con sus items, en vivo. Solo para cajeros y admin.
 * `jornadaId` undefined = todavía no se sabe cuál (sigue cargando); null = no hay jornada (lista vacía).
 */
export function usePedidos(jornadaId: string | null | undefined) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const actual = useRef(jornadaId)
  actual.current = jornadaId

  const recargar = useCallback(async () => {
    if (jornadaId === undefined) return
    if (jornadaId === null) {
      setPedidos([])
      setError(null)
      setCargando(false)
      return
    }
    const { data, error } = await supabase
      .from('pedidos')
      .select(SELECT_PEDIDO)
      .eq('jornada_id', jornadaId)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (actual.current !== jornadaId) return // se cambió de jornada mientras cargaba
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
  }, [jornadaId])

  useEffect(() => {
    setCargando(true)
    recargar()
  }, [recargar])

  useTiempoReal('pedidos', recargar)

  return { pedidos, cargando, error, recargar }
}
