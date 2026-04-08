import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const PREVIEW_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PREVIEW_MODE === 'true'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (PREVIEW_MODE) return <Outlet />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
