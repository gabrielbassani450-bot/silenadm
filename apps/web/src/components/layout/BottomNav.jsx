import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Calendar, Users } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: ArrowLeftRight,   label: 'Transações' },
  { to: '/calendar',     icon: Calendar,         label: 'Agenda' },
]

export default function BottomNav() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const items = isAdmin
    ? [...NAV, { to: '/users', icon: Users, label: 'Usuários' }]
    : NAV

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200/80 safe-area-bottom">
      <div className="flex items-center justify-around px-1 h-14">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[60px] transition-all duration-150',
              isActive
                ? 'text-indigo-600'
                : 'text-slate-400 active:text-slate-600',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
