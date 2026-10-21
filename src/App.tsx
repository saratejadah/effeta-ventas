import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import type { Rol } from './lib/types'
import { Cargando } from './components/ui'
import PedidoPage from './pages/Pedido'
import LoginPage from './pages/Login'

// Caja y admin se descargan solo cuando se necesitan (el link público queda más liviano)
const CajaPage = lazy(() => import('./pages/Caja'))
const AdminPage = lazy(() => import('./pages/Admin'))

/** Deja pasar solo a usuarios con sesión, perfil activo y uno de los roles permitidos */
function Protegida({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { session, perfil, cargando } = useAuth()
  if (cargando) return <Cargando />
  if (!session || !perfil || !perfil.activo) return <Navigate to="/login" replace />
  if (!roles.includes(perfil.rol)) return <Navigate to={perfil.rol === 'admin' ? '/admin' : '/caja'} replace />
  return <Suspense fallback={<Cargando />}>{children}</Suspense>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/pedido" element={<PedidoPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/caja"
            element={
              <Protegida roles={['cajero', 'admin']}>
                <CajaPage />
              </Protegida>
            }
          />
          <Route
            path="/admin"
            element={
              <Protegida roles={['admin']}>
                <AdminPage />
              </Protegida>
            }
          />
          <Route path="*" element={<Navigate to="/pedido" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
