import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Shield, ShieldCheck, Eye, UserX, UserCheck, Users as UsersIcon } from 'lucide-react'
import { usersApi } from '../services/api'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import PageError from '../components/ui/PageError'
import useAuthStore from '../store/authStore'

const ROLE_BADGE = {
  ADMIN:   { label: 'Admin',        cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60' },
  MANAGER: { label: 'Gerente',      cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60' },
  VIEWER:  { label: 'Visualizador', cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60' },
}

const ROLE_ICON = { ADMIN: ShieldCheck, MANAGER: Shield, VIEWER: Eye }

function UserCard({ user: u }) {
  const RIcon = ROLE_ICON[u.role] || Eye
  const badge = ROLE_BADGE[u.role] || ROLE_BADGE.VIEWER
  const initials = u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className={`card-sm flex items-center gap-3 transition-all ${!u.isActive ? 'opacity-50' : ''}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-slate-800 truncate">{u.name}</p>
          {!u.isActive && (
            <span className="badge bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 text-[10px]">Inativo</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
      </div>
      <span className={`badge text-[10px] ${badge.cls}`}>
        <RIcon size={10} />
        {badge.label}
      </span>
    </div>
  )
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await usersApi.list()
      setUsers(data.data)
    } catch (err) {
      setError(err)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (currentUser?.role !== 'ADMIN') {
    return (
      <EmptyState
        icon={Shield}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar usuários."
      />
    )
  }

  const active = users.filter(u => u.isActive)
  const inactive = users.filter(u => !u.isActive)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Usuários</h2>
        <p className="text-[11.5px] text-slate-400 mt-0.5">
          {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-indigo-500" />
        </div>
      ) : error ? (
        <PageError error={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum usuário" description="Nenhum usuário cadastrado no sistema." />
      ) : (
        <div className="space-y-5">
          {/* Ativos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck size={13} className="text-emerald-500" />
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Ativos ({active.length})
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {active.map(u => <UserCard key={u.id} user={u} />)}
            </div>
          </div>

          {/* Inativos */}
          {inactive.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserX size={13} className="text-rose-400" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Inativos ({inactive.length})
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {inactive.map(u => <UserCard key={u.id} user={u} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
