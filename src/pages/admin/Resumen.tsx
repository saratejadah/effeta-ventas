import { useMemo } from 'react'
import { Download, Globe, Store } from 'lucide-react'
import { METODOS_PAGO, textoMetodo } from '../../lib/pago'
import { usePedidos, useProductos } from '../../lib/hooks'
import { descargarCSV } from '../../lib/csv'
import { numeroPedido, precio } from '../../lib/format'
import { Aviso, BotonSecundario, Card, Cargando, Hero, IconBox, SectionLabel, StatCard } from '../../components/ui'

export default function Resumen({ nombre }: { nombre?: string }) {
  const { pedidos, cargando: c1, error: e1 } = usePedidos()
  const { productos, cargando: c2, error: e2 } = useProductos(true)

  const datos = useMemo(() => {
    const validos = pedidos.filter((p) => p.estado !== 'cancelado')
    const cobrados = validos.filter((p) => p.estado !== 'pendiente')
    const porCobrar = validos.filter((p) => p.estado === 'pendiente')

    // Ventas por cajero (las online se agrupan aparte)
    const porCajero = new Map<string, { nombre: string; online: boolean; pedidos: number; total: number }>()
    for (const p of cobrados) {
      const clave = p.canal === 'online' ? 'online' : (p.cajero_id ?? 'sin')
      const nombre = p.canal === 'online' ? 'Pedidos online' : (p.perfiles?.nombre ?? 'Sin cajero')
      const fila = porCajero.get(clave) ?? { nombre, online: p.canal === 'online', pedidos: 0, total: 0 }
      fila.pedidos += 1
      fila.total += p.total
      porCajero.set(clave, fila)
    }

    // Lo cobrado por método de pago
    const porMetodo = METODOS_PAGO.map((m) => {
      const lista = cobrados.filter((p) => p.metodo_pago === m.id)
      return { ...m, pedidos: lista.length, total: lista.reduce((s, p) => s + p.total, 0) }
    })
    const sinMetodo = cobrados.filter((p) => !p.metodo_pago)

    // Unidades vendidas por producto (pedidos no cancelados)
    const vendidas = new Map<string, number>()
    for (const p of validos) for (const i of p.pedido_items ?? []) vendidas.set(i.producto_id, (vendidas.get(i.producto_id) ?? 0) + i.cantidad)

    return {
      totalVendido: cobrados.reduce((s, p) => s + p.total, 0),
      totalPorCobrar: porCobrar.reduce((s, p) => s + p.total, 0),
      numPedidos: validos.length,
      numPorCobrar: porCobrar.length,
      agotados: productos.filter((p) => p.activo && p.stock <= 0).length,
      porMetodo,
      sinMetodo: { pedidos: sinMetodo.length, total: sinMetodo.reduce((s, p) => s + p.total, 0) },
      porCajero: [...porCajero.values()].sort((a, b) => b.total - a.total),
      porProducto: productos
        .map((p) => ({ producto: p, vendidas: vendidas.get(p.id) ?? 0 }))
        .sort((a, b) => b.vendidas - a.vendidas),
    }
  }, [pedidos, productos])

  function exportarPedidos() {
    const filas: (string | number | null)[][] = [
      ['Número', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Canal', 'Cajero', 'Estado', 'Método de pago', 'Total', 'Detalle'],
    ]
    for (const p of [...pedidos].sort((a, b) => a.numero - b.numero)) {
      const f = new Date(p.created_at)
      filas.push([
        numeroPedido(p.numero),
        f.toLocaleDateString('es-CO'),
        f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        p.nombre_cliente,
        p.telefono,
        p.canal,
        p.perfiles?.nombre ?? '',
        p.estado,
        p.metodo_pago ? textoMetodo(p.metodo_pago) : '',
        p.total,
        (p.pedido_items ?? []).map((i) => `${i.cantidad}x ${i.productos?.nombre ?? ''}`).join(', '),
      ])
    }
    descargarCSV(`pedidos-${hoy()}.csv`, filas)
  }

  function exportarProductos() {
    const filas: (string | number)[][] = [['Producto', 'Precio', 'Vendidas', 'Restantes', 'Total vendido', 'Activo']]
    for (const { producto: p, vendidas } of datos.porProducto) {
      filas.push([p.nombre, p.precio, vendidas, p.stock, p.precio * vendidas, p.activo ? 'sí' : 'no'])
    }
    descargarCSV(`productos-${hoy()}.csv`, filas)
  }

  const primerNombre = nombre?.split(' ')[0]

  return (
    <>
      <Hero
        etiqueta="Resumen de la jornada"
        titulo={primerNombre ? `Hola, ${primerNombre}` : 'Hola'}
        subtitulo="Así va la jornada de ventas. Todo se actualiza en vivo."
      />
      <main className="relative mx-auto -mt-10 max-w-[600px] space-y-5 px-4">
        {c1 || c2 ? (
          <Card>
            <Cargando />
          </Card>
        ) : e1 || e2 ? (
          <Aviso tipo="error">No pudimos cargar el resumen: {e1 ?? e2}</Aviso>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard color="verde" valor={precio(datos.totalVendido)} etiqueta="Total vendido" />
              <StatCard color="oscuro" valor={datos.numPedidos} etiqueta="Pedidos" />
              <StatCard color="naranja" valor={datos.agotados} etiqueta="Productos agotados" />
            </div>

            {datos.numPorCobrar > 0 && (
              <Aviso tipo="error">
                Hay {datos.numPorCobrar} {datos.numPorCobrar === 1 ? 'pedido' : 'pedidos'} por cobrar (
                {precio(datos.totalPorCobrar)}).
              </Aviso>
            )}

            <section>
              <SectionLabel className="mb-2">Cobrado por método de pago</SectionLabel>
              <Card sinPadding>
                <ul className="divide-y divide-line">
                  {datos.porMetodo.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <IconBox icon={m.icon} color={m.id === 'efectivo' ? 'verde' : m.id === 'transferencia' ? 'indigo' : 'morado'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{m.texto}</p>
                        <p className="text-xs text-muted">
                          {m.pedidos} {m.pedidos === 1 ? 'pago' : 'pagos'}
                        </p>
                      </div>
                      <p className="font-bold tabular-nums">{precio(m.total)}</p>
                    </li>
                  ))}
                  {datos.sinMetodo.pedidos > 0 && (
                    <li className="flex items-center justify-between px-4 py-3 text-sm text-muted">
                      <span>Sin método registrado ({datos.sinMetodo.pedidos})</span>
                      <span className="font-semibold tabular-nums">{precio(datos.sinMetodo.total)}</span>
                    </li>
                  )}
                </ul>
              </Card>
            </section>

            <section>
              <SectionLabel className="mb-2">Ventas por cajero</SectionLabel>
              <Card sinPadding>
                {datos.porCajero.length === 0 ? (
                  <p className="p-5 text-sm text-muted">Aún no hay ventas cobradas.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {datos.porCajero.map((c) => (
                      <li key={c.nombre} className="flex items-center gap-3 px-4 py-3">
                        <IconBox icon={c.online ? Globe : Store} color={c.online ? 'morado' : 'indigo'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{c.nombre}</p>
                          <p className="text-xs text-muted">
                            {c.pedidos} {c.pedidos === 1 ? 'venta' : 'ventas'}
                          </p>
                        </div>
                        <p className="font-bold tabular-nums">{precio(c.total)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            <section>
              <SectionLabel className="mb-2">Unidades por producto</SectionLabel>
              <Card className="space-y-4">
                {datos.porProducto.length === 0 ? (
                  <p className="text-sm text-muted">Aún no hay productos.</p>
                ) : (
                  datos.porProducto.map(({ producto: p, vendidas }) => {
                    const total = vendidas + p.stock
                    const pct = total > 0 ? Math.round((vendidas / total) * 100) : 0
                    return (
                      <div key={p.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={`truncate text-sm font-semibold ${p.activo ? '' : 'text-muted'}`}>{p.nombre}</p>
                          <p className="shrink-0 text-xs text-muted">
                            <span className="font-semibold text-accent">{vendidas} vendidas</span> · {p.stock} quedan
                          </p>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-page">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </Card>
            </section>

            <section className="space-y-2">
              <SectionLabel>Exportar</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <BotonSecundario icon={Download} onClick={exportarPedidos}>
                  Pedidos (CSV)
                </BotonSecundario>
                <BotonSecundario icon={Download} onClick={exportarProductos}>
                  Productos (CSV)
                </BotonSecundario>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}
