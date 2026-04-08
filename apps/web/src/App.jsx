import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore'

import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import CalendarPage from './pages/Calendar'
import UsersPage from './pages/Users'

// Spinner de inicialização
function AppLoader() {
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-slate-400 text-sm font-medium">Carregando…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { init, isInitializing, logout } = useAuthStore()

  useEffect(() => {
    init()

    // Listener para logout forçado (token expirado e refresh falhou)
    const handler = () => logout()
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isInitializing) return <AppLoader />

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Toaster
        position="top-right"
        containerClassName="!top-2 !right-2 sm:!top-4 sm:!right-4"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderRadius: '12px',
            padding: '10px 14px',
            maxWidth: '380px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
            style: { borderLeft: '3px solid #10b981' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#f8fafc' },
            style: { borderLeft: '3px solid #f43f5e' },
            duration: 5000,
          },
        }}
      />

      <Routes>
        {/* Rotas públicas */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Rotas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/calendar"     element={<CalendarPage />} />
            <Route path="/users"        element={<UsersPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
