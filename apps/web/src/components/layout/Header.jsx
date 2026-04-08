import { useLocation } from 'react-router-dom'
import { Menu, Bell } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const PAGE_META = {
  '/dashboard':    { title: 'Dashboard',   desc: 'Visão geral das finanças' },
  '/transactions': { title: 'Transações',  desc: 'Receitas e despesas' },
  '/calendar':     { title: 'Calendário',  desc: 'Reuniões agendadas' },
  '/users':        { title: 'Usuários',    desc: 'Gerenciar acessos' },
}

function Avatar({ name = '' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm font-bold text-white text-xs flex-shrink-0">
      {initials}
    </div>
  )
}

export default function Header({ onMenuToggle }) {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const meta = PAGE_META[pathname] || { title: 'Dashboard', desc: '' }

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center px-4 sm:px-5 gap-3 flex-shrink-0">
      {/* Mobile menu */}
      <button
        className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={onMenuToggle}
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      {/* Título + descrição */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-slate-800 leading-tight truncate">{meta.title}</h1>
        {meta.desc && (
          <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">{meta.desc}</p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        {/* Notificações placeholder */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors hidden sm:flex">
          <Bell size={16} />
        </button>

        {/* Separador */}
        <div className="w-px h-6 bg-slate-200 hidden sm:block" />

        {/* Usuário */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block text-right leading-tight">
            <p className="text-[12px] font-semibold text-slate-700">{user?.name}</p>
            <p className="text-[11px] text-slate-400">{user?.role === 'ADMIN' ? 'Admin' : user?.email}</p>
          </div>
          <Avatar name={user?.name} />
        </div>
      </div>
    </header>
  )
}
