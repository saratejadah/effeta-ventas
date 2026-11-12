export type Rol = 'admin' | 'cajero'
export type Estado = 'pendiente' | 'pagado' | 'entregado' | 'cancelado'
export type Canal = 'online' | 'presencial'
export type MetodoPago = 'efectivo' | 'transferencia'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
  created_at: string
}

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  stock: number
  imagen_url: string | null
  activo: boolean
  created_at: string
}

export interface Jornada {
  id: string
  nombre: string
  abierta: boolean
  created_at: string
  cerrada_at: string | null
}

export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string | null
  nombre_producto: string | null
  cantidad: number
  precio_unitario: number
  productos?: { nombre: string } | null
}

export interface Pedido {
  id: string
  jornada_id: string
  /** Número dentro de su jornada (empieza en 1 en cada jornada) */
  numero: number
  nombre_cliente: string
  telefono: string | null
  canal: Canal
  estado: Estado
  cajero_id: string | null
  metodo_pago: MetodoPago | null
  /** A qué hora dijo la persona que recoge (solo pedidos del link) */
  hora_recogida?: string | null
  /** Ya se entregó pero todavía debe el pago (solo con estado 'entregado') */
  pago_pendiente?: boolean
  total: number
  created_at: string
  perfiles?: { nombre: string } | null
  pedido_items?: PedidoItem[]
}

export type Carrito = Record<string, number>
