import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // envia cookies HttpOnly (refresh_token) automaticamente
  headers: { 'Content-Type': 'application/json' },
})

// ─── Interceptor de request: injeta access token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Access token em memória (não no localStorage — mais seguro contra XSS) ──
let _accessToken = null
let _refreshPromise = null  // evita múltiplos refreshes simultâneos

export function setAccessToken(token) { _accessToken = token }
export function getAccessToken() { return _accessToken }
export function clearAccessToken() { _accessToken = null }

// ─── Interceptor de response: auto-refresh em 401 ────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Evita loop infinito: não tenta refresh no próprio endpoint de refresh/login
    const isAuthRoute = original.url?.includes('/auth/refresh') ||
                        original.url?.includes('/auth/login') ||
                        original.url?.includes('/auth/logout') ||
                        original.url?.includes('/auth/logout-all')

    if (error.response?.status === 401 && !original._retried && !isAuthRoute) {
      original._retried = true

      try {
        // Deduplica: se já está fazendo refresh, espera o mesmo promise.
        // Timeout de 10s evita que promise trave indefinidamente em falha de rede.
        if (!_refreshPromise) {
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Refresh timeout')), 10_000)
          )
          _refreshPromise = Promise.race([api.post('/auth/refresh'), timeout])
            .finally(() => { _refreshPromise = null })
        }
        const { data } = await _refreshPromise
        setAccessToken(data.data.accessToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        clearAccessToken()
        window.dispatchEvent(new Event('auth:logout'))
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// ─── Helpers de API ───────────────────────────────────────────────────────────

export const authApi = {
  register: (body) => api.post('/auth/register', body),
  login: (body) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
}

export const financialApi = {
  getSummary: (params) => api.get('/financial/summary', { params }),
  getMonthlySummary: (months = 6) => api.get('/financial/summary/monthly', { params: { months } }),
  listTransactions: (params) => api.get('/financial/transactions', { params }),
  getTransaction: (id) => api.get(`/financial/transactions/${id}`),
  createTransaction: (body) => api.post('/financial/transactions', body),
  updateTransaction: (id, body) => api.patch(`/financial/transactions/${id}`, body),
  deleteTransaction: (id) => api.delete(`/financial/transactions/${id}`),
  listCategories: () => api.get('/financial/categories'),
}

export const meetingsApi = {
  list: (params) => api.get('/meetings', { params }),
  getUpcoming: (limit = 5) => api.get('/meetings/upcoming', { params: { limit } }),
  get: (id) => api.get(`/meetings/${id}`),
  create: (body) => api.post('/meetings', body),
  update: (id, body) => api.patch(`/meetings/${id}`, body),
  delete: (id) => api.delete(`/meetings/${id}`),
}

export const usersApi = {
  list: () => api.get('/users'),
}

export default api
