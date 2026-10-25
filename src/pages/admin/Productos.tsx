import { useState, type FormEvent } from 'react'
import { Camera, ImageOff, PackagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProductos } from '../../lib/hooks'
import { mensajeError, precio } from '../../lib/format'
import type { Producto } from '../../lib/types'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Card,
  Cargando,
  Contenido,
  Pill,
  StockPill,
  TituloPagina,
} from '../../components/ui'

export default function Productos() {
  const { productos, cargando, error, recargar } = useProductos(true)
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)

  if (editando) {
    return (
      <FormularioProducto
        producto={editando === 'nuevo' ? null : editando}
        onCerrar={() => {
          setEditando(null)
          recargar()
        }}
      />
    )
  }

  return (
    <Contenido className="space-y-4 pt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <TituloPagina>Productos</TituloPagina>
          <p className="mt-1 text-sm text-muted">Crea, edita y ajusta el inventario.</p>
        </div>
      </div>
      <BotonPrincipal icon={Plus} onClick={() => setEditando('nuevo')}>
        Nuevo producto
      </BotonPrincipal>

      {cargando ? (
        <Cargando />
      ) : error ? (
        <Aviso tipo="error">No pudimos cargar los productos: {error}</Aviso>
      ) : productos.length === 0 ? (
        <Card className="text-center text-sm text-muted">Aún no hay productos. ¡Crea el primero!</Card>
      ) : (
        productos.map((p) => <FilaProducto key={p.id} producto={p} onEditar={() => setEditando(p)} />)
      )}
    </Contenido>
  )
}

function FilaProducto({ producto: p, onEditar }: { producto: Producto; onEditar: () => void }) {
  const [sumando, setSumando] = useState(false)
  const [unidades, setUnidades] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleActivo() {
    setOcupado(true)
    setError(null)
    const { error } = await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    setOcupado(false)
    if (error) setError(mensajeError(error))
  }

  async function sumar(e: FormEvent) {
    e.preventDefault()
    const n = parseInt(unidades, 10)
    if (!n || n <= 0) return
    setOcupado(true)
    setError(null)
    const err = await sumarStock(p.id, n)
    setOcupado(false)
    if (err) setError(err)
    else {
      setUnidades('')
      setSumando(false)
    }
  }

  return (
    <div className={`rounded-2xl border border-line bg-white p-3 ${p.activo ? '' : 'opacity-70'}`}>
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-page">
          {p.imagen_url ? (
            <img src={p.imagen_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted/50">
              <ImageOff size={20} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug">{p.nombre}</p>
            {p.activo ? <StockPill stock={p.stock} /> : <Pill color="gris">Inactivo</Pill>}
          </div>
          <p className="mt-0.5 text-sm font-bold tabular-nums">{precio(p.precio)}</p>
          <p className="text-xs text-muted">{p.stock} en inventario</p>
        </div>
      </div>

      {sumando ? (
        <form onSubmit={sumar} className="mt-3 flex gap-2">
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="¿Cuántas unidades llegaron?"
            value={unidades}
            onChange={(e) => setUnidades(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-[15px] outline-none focus:border-primary"
          />
          <button type="submit" disabled={ocupado} className="rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
            Sumar
          </button>
          <button type="button" onClick={() => setSumando(false)} className="px-2 text-muted" aria-label="Cancelar">
            <X size={18} />
          </button>
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <BotonSecundario className="px-2" icon={PackagePlus} onClick={() => setSumando(true)}>
            Stock
          </BotonSecundario>
          <BotonSecundario className="px-2" icon={Pencil} onClick={onEditar}>
            Editar
          </BotonSecundario>
          <BotonSecundario className="px-2" disabled={ocupado} onClick={toggleActivo}>
            {p.activo ? 'Desactivar' : 'Activar'}
          </BotonSecundario>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
    </div>
  )
}

/**
 * Suma unidades sin pisar ventas que pasen al mismo tiempo:
 * solo actualiza si el stock no cambió desde que lo leímos; si cambió, reintenta.
 */
async function sumarStock(id: string, n: number): Promise<string | null> {
  for (let intento = 0; intento < 5; intento++) {
    const { data: actual, error: e1 } = await supabase.from('productos').select('stock').eq('id', id).single()
    if (e1) return mensajeError(e1)
    const { data, error: e2 } = await supabase
      .from('productos')
      .update({ stock: actual.stock + n })
      .eq('id', id)
      .eq('stock', actual.stock)
      .select('id')
    if (e2) return mensajeError(e2)
    if (data && data.length > 0) return null
  }
  return 'Hay muchas ventas en este momento. Intenta de nuevo.'
}

function FormularioProducto({ producto, onCerrar }: { producto: Producto | null; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [valor, setValor] = useState(producto ? String(producto.precio) : '')
  const [stock, setStock] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(producto?.imagen_url ?? null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegirFoto(f: File | undefined) {
    if (!f) return
    setFoto(f)
    setVista(URL.createObjectURL(f))
  }

  async function eliminar() {
    if (!producto) return
    if (
      !window.confirm(
        `¿Eliminar "${producto.nombre}" para siempre? Deja de aparecer en la caja y en el link de pedidos. Las ventas que ya tuvo se conservan en los registros. No se puede deshacer.`,
      )
    )
      return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('productos').delete().eq('id', producto.id)
    if (error) {
      setError(mensajeError(error))
      setGuardando(false)
      return
    }
    // Borrar también su foto (si falla no pasa nada, el producto ya se eliminó)
    const ruta = producto.imagen_url?.split('/productos/')[1]
    if (ruta) await supabase.storage.from('productos').remove([decodeURIComponent(ruta)])
    onCerrar()
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const precioNum = parseInt(valor.replace(/\D/g, ''), 10)
    if (!nombre.trim()) return setError('El producto necesita un nombre.')
    if (isNaN(precioNum)) return setError('Escribe el precio en pesos, sin puntos ni comas.')

    setGuardando(true)
    setError(null)
    try {
      let imagen_url = producto?.imagen_url ?? null
      if (foto) {
        const ext = foto.name.split('.').pop()?.toLowerCase() || 'jpg'
        const ruta = `${crypto.randomUUID()}.${ext}`
        const { error: eSubida } = await supabase.storage.from('productos').upload(ruta, foto, { contentType: foto.type })
        if (eSubida) throw new Error('No se pudo subir la foto: ' + eSubida.message)
        imagen_url = supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl
      }

      const campos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, precio: precioNum, imagen_url }
      const { error } = producto
        ? await supabase.from('productos').update(campos).eq('id', producto.id)
        : await supabase.from('productos').insert({ ...campos, stock: parseInt(stock, 10) || 0 })
      if (error) throw error
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <Contenido className="space-y-4 pt-5">
      <div className="flex items-center justify-between">
        <TituloPagina>{producto ? 'Editar producto' : 'Nuevo producto'}</TituloPagina>
        <button onClick={onCerrar} className="rounded-full p-2 text-muted active:bg-white" aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>

      <form onSubmit={guardar} className="space-y-4">
        <Card className="space-y-4">
          <label className="flex cursor-pointer items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-page text-muted">
              {vista ? <img src={vista} alt="" className="h-full w-full object-cover" /> : <Camera size={26} strokeWidth={1.5} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">{vista ? 'Cambiar foto' : 'Subir foto'}</p>
              <p className="text-xs text-muted">Opcional. Una foto cuadrada se ve mejor.</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
          </label>

          <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Empanada de pollo" required />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">Descripción (opcional)</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Una frase corta para antojar"
              className="w-full resize-none rounded-lg border border-line bg-white px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/70 focus:border-primary"
            />
          </label>
          <Campo
            label="Precio (en pesos)"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 5000"
            required
          />
          {valor && <p className="-mt-2 text-xs text-muted">Se verá como {precio(Number(valor))}</p>}
          {!producto && (
            <Campo
              label="Unidades disponibles"
              type="number"
              inputMode="numeric"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Ej. 30"
            />
          )}
        </Card>

        {error && <Aviso tipo="error">{error}</Aviso>}
        <BotonPrincipal type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
        </BotonPrincipal>
        <BotonSecundario type="button" className="w-full" onClick={onCerrar}>
          Cancelar
        </BotonSecundario>
        {producto && (
          <BotonSecundario type="button" className="w-full text-danger" icon={Trash2} disabled={guardando} onClick={eliminar}>
            Eliminar producto
          </BotonSecundario>
        )}
      </form>
    </Contenido>
  )
}
