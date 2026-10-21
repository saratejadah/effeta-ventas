import { useState } from 'react'
import { ClipboardList, LayoutDashboard, Package, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { BottomNav, Header, type Tab } from '../components/ui'
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

  return (
    <div className="min-h-dvh pb-24">
      <Header nombre={perfil?.nombre} onSalir={salir} />
      {pestana === 'resumen' && <Resumen nombre={perfil?.nombre} />}
      {pestana === 'productos' && <Productos />}
      {pestana === 'pedidos' && <Pedidos />}
      {pestana === 'cajeros' && <Cajeros />}
      <BottomNav tabs={tabs} activo={pestana} onChange={setPestana} />
    </div>
  )
}
