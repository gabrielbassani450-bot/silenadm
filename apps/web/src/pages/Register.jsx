import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Check, ArrowLeft } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { authApi } from '../services/api'
import Spinner from '../components/ui/Spinner'
import { isValidCPF, maskCPF } from '../utils/cpf'

const PASSWORD_RULES = [
  { test: (v) => v.length >= 8,           label: 'Mínimo 8 caracteres' },
  { test: (v) => /[A-Z]/.test(v),         label: 'Uma letra maiúscula' },
  { test: (v) => /[0-9]/.test(v),         label: 'Um número' },
  { test: (v) => /[^A-Za-z0-9]/.test(v),  label: 'Um caractere especial' },
]

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [loading,      setLoading]      = useState(false)

  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm()
  const watchedPassword = watch('password', '')

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  async function onSubmit({ name, email, cpf, password }) {
    setLoading(true)
    try {
      const payload = { name, email, password }
      if (cpf && cpf.trim()) payload.cpf = cpf.replace(/\D/g, '')
      await authApi.register(payload)
      toast.success('Conta criada com sucesso! Faça login.')
      navigate('/login', { replace: true })
    } catch (err) {
      const status = err?.response?.status
      const msg    = err?.response?.data?.error?.message || 'Erro ao criar conta'
      if (status === 409) setError('email', { message: 'Este e-mail já está cadastrado' })
      else if (status === 429) toast.error('Muitas tentativas. Aguarde 15 minutos.')
      else toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f7f8fa]">

      {/* Painel esquerdo */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-sidebar flex-col justify-between p-10 relative overflow-hidden flex-shrink-0">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[14px] font-bold text-white tracking-tight">FinanceADM</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-[1.2] tracking-tight mb-4">
            Comece a controlar<br />
            suas <span className="text-indigo-400">finanças hoje.</span>
          </h2>
          <p className="text-[13.5px] text-white/50 leading-relaxed max-w-xs">
            Crie sua conta gratuitamente e tenha acesso ao dashboard completo com relatórios e integração Google Sheets.
          </p>

          <div className="flex flex-col gap-2.5 mt-8">
            {[
              'Acesso imediato após o cadastro',
              'Dados isolados por usuário',
              'Sem limite de transações',
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

      {/* Painel direito */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">

          <Link to="/login"
            className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors mb-6 font-medium">
            <ArrowLeft size={13} /> Voltar ao login
          </Link>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Criar conta</h1>
          <p className="text-[13px] text-slate-500 mb-7">
            Preencha os dados abaixo para começar
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Nome */}
            <div>
              <label className="label">Nome completo</label>
              <input type="text" placeholder="Seu nome"
                className={`input-field ${errors.name ? 'border-rose-400 focus:ring-rose-500/30' : ''}`}
                {...register('name', {
                  required: 'Nome obrigatório',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' },
                  maxLength: { value: 100, message: 'Máximo 100 caracteres' },
                })}
              />
              {errors.name && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.name.message}</p>}
            </div>

            {/* E-mail */}
            <div>
              <label className="label">E-mail</label>
              <input type="email" placeholder="seu@email.com"
                className={`input-field ${errors.email ? 'border-rose-400 focus:ring-rose-500/30' : ''}`}
                {...register('email', {
                  required: 'E-mail obrigatório',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
                })}
              />
              {errors.email && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.email.message}</p>}
            </div>

            {/* CPF */}
            <div>
              <label className="label">CPF <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input type="text" placeholder="000.000.000-00" inputMode="numeric" maxLength={14}
                className={`input-field ${errors.cpf ? 'border-rose-400 focus:ring-rose-500/30' : ''}`}
                {...register('cpf', {
                  validate: (v) => {
                    if (!v || v.trim() === '') return true
                    return isValidCPF(v) || 'CPF inválido'
                  },
                  onChange: (e) => { e.target.value = maskCPF(e.target.value) },
                })}
              />
              {errors.cpf && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.cpf.message}</p>}
            </div>

            {/* Senha */}
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  className={`input-field pr-10 ${errors.password ? 'border-rose-400 focus:ring-rose-500/30' : ''}`}
                  {...register('password', {
                    required: 'Senha obrigatória',
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    maxLength: { value: 72, message: 'Máximo 72 caracteres' },
                    pattern: {
                      value: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/,
                      message: 'A senha não atende os requisitos',
                    },
                  })}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.password.message}</p>}

              {/* Requisitos de senha */}
              {watchedPassword.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {PASSWORD_RULES.map(({ test, label }) => {
                    const ok = test(watchedPassword)
                    return (
                      <div key={label} className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {ok && <Check size={8} className="text-emerald-600" />}
                        </div>
                        {label}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="label">Confirmar senha</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} placeholder="••••••••"
                  className={`input-field pr-10 ${errors.confirmPassword ? 'border-rose-400 focus:ring-rose-500/30' : ''}`}
                  {...register('confirmPassword', {
                    required: 'Confirmação obrigatória',
                    validate: (v) => v === watchedPassword || 'As senhas não coincidem',
                  })}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
              {loading ? <><Spinner size="sm" /> Criando conta…</> : 'Criar conta'}
            </button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-slate-500">
            Já tem conta?{' '}
            <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
