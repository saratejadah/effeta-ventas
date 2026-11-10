import { useState } from 'react'
import { ClipboardList, LayoutDashboard, Package, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJornadas } from '../lib/hooks'
import { Aviso, BottomNav, Cargando, Contenido, Header, type Tab } from '../components/ui'
import Resumen from './admin/Resumen'
import Productos from './admin/Productos'
import Pedidos from './admin/Pedidos'
import Cajeros from './admin/Cajeros'

type Pestana = 'resumen' | 'productos' | 'pedidos' | 'cajeros'

const tabs: Tab<Pestana>[] = [
  { id: 'resumen', texto: 'Resumen', icon: LayoutDashboard },
  { id: 'productos', texto: 'Productos', icon: Package },
  { id: 'pedidos', texto: 'Pedidos', icon: ClipboardList },
  { id: 'cajeros', texto: 'Cajeros', icon: Users },
]

export default function AdminPage() {
  const { perfil, salir } = useAuth()
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const { jornadas, abierta, cargando, error, recargar } = useJornadas()
  // Jornada que se está mirando en Resumen y Pedidos. Si no se eligió otra: la abierta (o la última).
  const [elegida, setElegida] = useState<string | null>(null)
  const jornada = jornadas.find((j) => j.id === elegida) ?? abierta ?? jornadas[0] ?? null
  const vista = { jornadas, abierta, jornada, onElegir: setElegida, onCambio: () => {
      setElegida(null)
      recargar()
    },
  }

  const necesitaJornada = pestana === 'resumen' || pestana === 'pedidos'

  return (
    <div className="min-h-dvh pb-24">
      <Header nombre={perfil?.nombre} onSalir={salir} />
      {necesitaJornada && (cargando || error || !jornada) ? (
        <Contenido className="pt-5">
          {cargando ? (
            <Cargando />
          ) : (
            <Aviso tipo="error">
              No pudimos cargar las jornadas{error ? `: ${error}` : ''}. Revisa que se haya corrido la migración 003_jornadas.sql en Supabase.
            </Aviso>
          )}
        </Contenido>
      ) : (
        <>
          {pestana === 'resumen' && jornada && <Resumen nombre={perfil?.nombre} {...vista} jornada={jornada} />}
          {pestana === 'pedidos' && jornada && <Pedidos {...vista} jornada={jornada} />}
        </>
      )}
      {pestana === 'productos' && <Productos />}
      {pestana === 'cajeros' && <Cajeros />}
      <BottomNav tabs={tabs} activo={pestana} onChange={setPestana} />
    </div>
  )
}
