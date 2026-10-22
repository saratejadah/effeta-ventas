export type Rol = 'admin' | 'cajero'
export type Estado = 'pendiente' | 'pagado' | 'entregado' | 'cancelado'
export type Canal = 'online' | 'presencial'
export type MetodoPago = 'efectivo' | 'nequi' | 'daviplata' | 'transferencia'

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

export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  productos?: { nombre: string } | null
}

export interface Pedido {
  id: string
  numero: number
  nombre_cliente: string
  telefono: string | null
  canal: Canal
  estado: Estado
  cajero_id: string | null
  metodo_pago: MetodoPago | null
  total: number
  created_at: string
  perfiles?: { nombre: string } | null
  pedido_items?: PedidoItem[]
}

export type Carrito = Record<string, number>
