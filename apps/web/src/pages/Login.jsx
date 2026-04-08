import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../store/authStore'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const { login, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, setError } = useForm()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  async function onSubmit({ email, password }) {
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) setError('password', { message: 'E-mail ou senha incorretos' })
      else if (status === 429) toast.error('Muitas tentativas. Aguarde 15 minutos.')
      else toast.error(err?.response?.data?.error?.message || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f7f8fa]">

      {/* Painel esquerdo */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-sidebar flex-col justify-between p-10 relative overflow-hidden flex-shrink-0">
        {/* Efeito de luz sutil */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[14px] font-bold text-white tracking-tight">FinanceADM</span>
        </div>

        {/* Copy */}
        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-[1.2] tracking-tight mb-4">
            Controle financeiro<br />
            <span className="text-indigo-400">inteligente.</span>
          </h2>
          <p className="text-[13.5px] text-white/50 leading-relaxed max-w-xs">
            Dashboard completo com relatórios, calendário de reuniões e integração com Google Sheets.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-2.5 mt-8">
            {[
              'Controle de receitas e despesas',
              'Sincronização com Google Sheets',
              'Calendário de reuniões integrado',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                <span className="text-[12.5px] text-white/55 font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/20 font-medium">
          © {new Date().getFullYear()} FinanceADM
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[13px] font-bold text-slate-800">FinanceADM</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Entrar</h1>
          <p className="text-[13px] text-slate-500 mb-7">
            Acesse sua conta para continuar
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                className={`input-field ${errors.email ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/30' : ''}`}
                {...register('email', {
                  required: 'E-mail obrigatório',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
                })}
              />
              {errors.email && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`input-field pr-10 ${errors.password ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/30' : ''}`}
                  {...register('password', { required: 'Senha obrigatória' })}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
              {loading ? <><Spinner size="sm" /> Entrando…</> : 'Entrar na plataforma'}
            </button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-slate-500">
            Não tem conta?{' '}
            <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
              Criar conta gratuita
            </Link>
          </p>

          {/* Dev hint — credenciais visíveis apenas em desenvolvimento */}
          {import.meta.env.DEV && (
            <div className="mt-5 p-3.5 bg-slate-100 rounded-lg border border-slate-200">
              <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dev — credenciais padrão</p>
              <p className="text-[11.5px] text-slate-600 font-mono">admin@dashboard.com</p>
              <p className="text-[11.5px] text-slate-600 font-mono">Admin@123456</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
