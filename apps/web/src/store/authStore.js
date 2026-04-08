import { create } from 'zustand'
import { authApi, setAccessToken, clearAccessToken } from '../services/api'

const PREVIEW_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PREVIEW_MODE === 'true'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,  // true enquanto tenta refresh na inicialização

  // ─── Inicialização: tenta recuperar sessão via refresh token (cookie) ─────
  init: async () => {
    if (PREVIEW_MODE) {
      try {
        const { data } = await authApi.refresh()
        setAccessToken(data.data.accessToken)
        const meRes = await authApi.me()
        set({ user: meRes.data.data, isAuthenticated: true, isInitializing: false })
        return
      } catch {
        // backend offline em dev → usa mock
        set({
          user: { id: 'preview', name: 'Administrador', email: 'admin@dashboard.com', role: 'ADMIN' },
          isAuthenticated: true,
          isInitializing: false,
        })
        return
      }
    }
    try {
      const { data } = await authApi.refresh()
      setAccessToken(data.data.accessToken)

      const meRes = await authApi.me()
      set({
        user: meRes.data.data,
        isAuthenticated: true,
        isInitializing: false,
      })
    } catch {
      clearAccessToken()
      set({ user: null, isAuthenticated: false, isInitializing: false })
    }
  },

  // ─── Login ────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    const { data } = await authApi.login({ email, password })
    setAccessToken(data.data.accessToken)
    set({ user: data.data.user, isAuthenticated: true })
    return data.data.user
  },

  // ─── Logout ───────────────────────────────────────────────────────────────
  logout: async () => {
    try { await authApi.logout() } catch { /* o estado local ainda precisa ser limpo */ }
    clearAccessToken()
    set({ user: null, isAuthenticated: false })
  },

  // ─── Atualiza dados do usuário (após edição de perfil) ───────────────────
  setUser: (user) => set({ user }),
}))

export default useAuthStore
