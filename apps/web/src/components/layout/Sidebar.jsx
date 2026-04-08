import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Calendar, LogOut, Users, X } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,   label: 'Transações' },
  { to: '/calendar',     icon: Calendar,         label: 'Calendário' },
]

const ROLE_LABEL = { ADMIN: 'Admin', MANAGER: 'Gerente', VIEWER: 'Visualizador' }

function Avatar({ name = '', size = 'md' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm`}>
      {initials}
    </div>
  )
}

export default function Sidebar({ mobile = false, onClose }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'ADMIN'

  async function handleLogout() {
    await logout()
    toast.success('Até logo!')
    navigate('/login')
  }

  return (
    <aside className="flex flex-col h-full w-[220px] bg-sidebar select-none overflow-hidden">

      {/* Logotipo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <span className="text-[13px] font-bold text-white tracking-tight">FinanceADM</span>
        </div>
        {mobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] px-2.5 pt-1 pb-2">
          Menu
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={mobile ? onClose : undefined}
            className={({ isActive }) => [
              'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/45 hover:text-white/80 hover:bg-white/5',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-white' : 'text-white/45 group-hover:text-white/70'} />
                <span className="flex-1">{label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />}
              </>
            )}
          </NavLink>
        ))}

        {/* Admin: gerenciar usuários */}
        {isAdmin && (
          <>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] px-2.5 pt-4 pb-2">
              Admin
            </p>
            <NavLink
              to="/users"
              onClick={mobile ? onClose : undefined}
              className={({ isActive }) => [
                'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/5',
              ].join(' ')}
            >
              {({ isActive }) => (
                <>
                  <Users size={15} className={isActive ? 'text-white' : 'text-white/45 group-hover:text-white/70'} />
                  <span className="flex-1">Usuários</span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />}
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Perfil + logout */}
      <div className="px-2 py-3 border-t border-white/5 flex-shrink-0">
        {/* Info do usuário */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-0.5">
          <Avatar name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-white/35 truncate mt-0.5 font-medium">
              {ROLE_LABEL[user?.role] || user?.role}
            </p>
          </div>
        </div>

        {/* Sair */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-white/35 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </aside>
  )
}
