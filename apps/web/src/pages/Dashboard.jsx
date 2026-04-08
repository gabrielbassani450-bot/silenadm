import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ArrowUpRight, ArrowDownRight, Wallet, Calendar, ArrowRight,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { financialApi, meetingsApi } from '../services/api'
import PageError from '../components/ui/PageError'
import useAuthStore from '../store/authStore'

const PREVIEW_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PREVIEW_MODE === 'true'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}
function fmtShort(val) {
  const n = val || 0
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}K`
  return fmtCurrency(n)
}

// ─── Stat Card — estilo Stripe ─────────────────────────────────────────────

const STAT_THEMES = {
  emerald: {
    accent:  'border-t-emerald-500',
    iconBg:  'bg-emerald-50',
    iconFg:  'text-emerald-600',
    sub:     'text-emerald-600',
  },
  rose: {
    accent:  'border-t-rose-500',
    iconBg:  'bg-rose-50',
    iconFg:  'text-rose-600',
    sub:     'text-rose-600',
  },
  indigo: {
    accent:  'border-t-indigo-500',
    iconBg:  'bg-indigo-50',
    iconFg:  'text-indigo-600',
    sub:     'text-indigo-600',
  },
  amber: {
    accent:  'border-t-amber-500',
    iconBg:  'bg-amber-50',
    iconFg:  'text-amber-600',
    sub:     'text-amber-600',
  },
}

function StatCard({ label, value, sub, icon: Icon, theme = 'indigo', loading }) {
  const t = STAT_THEMES[theme]
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 border-t-[3px] ${t.accent} p-5 shadow-card`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          {loading ? (
            <div className="mt-3 h-7 w-28 bg-slate-100 rounded-md animate-pulse" />
          ) : (
            <p className="mt-2 text-[26px] font-bold text-slate-900 tabular-nums leading-none tracking-tight">
              {fmtShort(value)}
            </p>
          )}
          {sub && !loading && (
            <p className={`mt-1.5 text-[11px] font-semibold ${t.sub}`}>{sub}</p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-lg ${t.iconBg} ${t.iconFg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  )
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-white/10 text-white text-[11px] rounded-lg shadow-xl px-3.5 py-2.5">
      <p className="font-semibold text-slate-300 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold ml-auto pl-3">{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-slate-900 border border-white/10 text-white text-[11px] rounded-lg shadow-xl px-3.5 py-2.5">
      <p className="font-semibold">{p.name}</p>
      <p className="text-slate-400 mt-0.5">{fmtCurrency(p.value)}</p>
    </div>
  )
}

const CATEGORY_COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899',
]

// ─── Dados mensais ────────────────────────────────────────────────────────────

const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

async function fetchMonthlyData() {
  const { data } = await financialApi.getMonthlySummary(6)
  return data.data.map((m) => {
    const [, month] = m.month.split('-')
    return {
      name: MONTH_NAMES[parseInt(month, 10) - 1],
      Receitas: m.totalReceitas,
      Despesas: m.totalDespesas,
    }
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-100 rounded-md ${className}`} />
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const user   = useAuthStore((s) => s.user)
  const [summary,    setSummary]    = useState(null)
  const [monthly,    setMonthly]    = useState([])
  const [categories, setCategories] = useState([])
  const [meetings,   setMeetings]   = useState([])
  const [recentTx,   setRecentTx]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumRes, monthData, txRes, mtRes] = await Promise.all([
        financialApi.getSummary({}),
        fetchMonthlyData(),
        financialApi.listTransactions({ limit: 5 }),
        meetingsApi.getUpcoming(3),
      ])
      setSummary(sumRes.data.data)
      setMonthly(monthData)
      setRecentTx(txRes.data.data)
      setMeetings(mtRes.data.data)
      const cats = (sumRes.data.data.porCategoria || [])
        .filter((c) => c.type === 'DESPESA' && c._sum.amount > 0)
        .map((c, i) => ({ name: c.category?.name || 'Sem categoria', value: Number(c._sum.amount), fill: c.category?.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      setCategories(cats)
    } catch (err) {
      if (PREVIEW_MODE) {
        setSummary({ totalReceitas: 18750, totalDespesas: 9320, saldo: 9430, quantidadeReceitas: 12, quantidadeDespesas: 24 })
        setMonthly([
          { name: 'nov', Receitas: 12000, Despesas: 7500 },
          { name: 'dez', Receitas: 15000, Despesas: 9200 },
          { name: 'jan', Receitas: 13500, Despesas: 8100 },
          { name: 'fev', Receitas: 16000, Despesas: 10500 },
          { name: 'mar', Receitas: 14200, Despesas: 7800 },
          { name: 'abr', Receitas: 18750, Despesas: 9320 },
        ])
        setCategories([
          { name: 'Moradia',     value: 3200, fill: '#6366f1' },
          { name: 'Alimentação', value: 2100, fill: '#10b981' },
          { name: 'Transporte',  value: 1800, fill: '#f59e0b' },
          { name: 'Saúde',       value: 1100, fill: '#ef4444' },
          { name: 'Lazer',       value: 920,  fill: '#8b5cf6' },
          { name: 'Outros',      value: 200,  fill: '#64748b' },
        ])
        setRecentTx([
          { id:'1', type:'RECEITA', description:'Salário mensal',    amount:8000, date:new Date().toISOString(), category:{name:'Salário'} },
          { id:'2', type:'DESPESA', description:'Aluguel',           amount:2500, date:new Date().toISOString(), category:{name:'Moradia'} },
          { id:'3', type:'DESPESA', description:'Supermercado',      amount:680,  date:new Date().toISOString(), category:{name:'Alimentação'} },
          { id:'4', type:'RECEITA', description:'Freelance design',  amount:3200, date:new Date().toISOString(), category:{name:'Freelance'} },
          { id:'5', type:'DESPESA', description:'Plano de saúde',    amount:420,  date:new Date().toISOString(), category:{name:'Saúde'} },
        ])
        setMeetings([
          { id:'1', title:'Planejamento Q2', startAt:new Date(Date.now()+86400000).toISOString(), location:'Google Meet', attendees:[{},{}] },
          { id:'2', title:'Review mensal',   startAt:new Date(Date.now()+259200000).toISOString(), location:'Sala 3', attendees:[{}] },
        ])
        return
      }
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = user?.name?.split(' ')[0] || ''

  if (error && !loading) {
    return <PageError error={error} onRetry={load} />
  }

  return (
    <div className="space-y-5">

      {/* ── Boas-vindas ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h2>
        </div>
        <Link to="/transactions" className="btn-primary text-xs px-3 py-2 hidden sm:inline-flex">
          <ArrowUpRight size={13} /> Nova transação
        </Link>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Receitas"
          value={summary?.totalReceitas}
          sub={`${summary?.quantidadeReceitas || 0} lançamentos`}
          icon={TrendingUp}
          theme="emerald"
          loading={loading}
        />
        <StatCard
          label="Despesas"
          value={summary?.totalDespesas}
          sub={`${summary?.quantidadeDespesas || 0} lançamentos`}
          icon={TrendingDown}
          theme="rose"
          loading={loading}
        />
        <StatCard
          label="Saldo"
          value={summary?.saldo}
          sub={summary?.saldo >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
          icon={Wallet}
          theme={summary?.saldo >= 0 ? 'indigo' : 'amber'}
          loading={loading}
        />
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Área */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-title">Evolução Mensal</p>
              <p className="section-sub">Receitas e despesas — últimos 6 meses</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f43f5e" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={fmtShort} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                <Legend iconType="circle" iconSize={7}
                  formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2}
                  fill="url(#gGreen)" dot={false}
                  activeDot={{ r: 3.5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} />
                <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={2}
                  fill="url(#gRed)" dot={false}
                  activeDot={{ r: 3.5, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie */}
        <div className="card">
          <p className="section-title mb-0.5">Por Categoria</p>
          <p className="section-sub mb-4">Distribuição de despesas</p>
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : categories.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400">
              Nenhuma despesa registrada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={categories} cx="50%" cy="40%"
                  innerRadius={48} outerRadius={74}
                  paddingAngle={3} dataKey="value"
                  isAnimationActive={false}>
                  {categories.map((c) => (
                    <Cell key={c.name} fill={c.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={7}
                  formatter={(v) => <span style={{ fontSize: 10, color: '#64748b' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Linha inferior ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Transações recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title">Transações Recentes</p>
            <Link to="/transactions"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
              Ver todas <ArrowRight size={11} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : recentTx.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Nenhuma transação ainda</p>
          ) : (
            <div className="space-y-0.5">
              {recentTx.map((tx) => (
                <div key={tx.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                    ${tx.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {tx.type === 'RECEITA'
                      ? <ArrowUpRight size={13} />
                      : <ArrowDownRight size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-800 truncate leading-tight">
                      {tx.description || tx.category?.name || '—'}
                    </p>
                    <p className="text-[10.5px] text-slate-400 leading-tight">
                      {tx.category?.name} · {format(new Date(tx.date), 'dd/MM')}
                    </p>
                  </div>
                  <p className={`text-[12.5px] font-bold tabular-nums flex-shrink-0
                    ${tx.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {tx.type === 'RECEITA' ? '+' : '−'}{fmtShort(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximas reuniões */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title">Próximas Reuniões</p>
            <Link to="/calendar"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
              Calendário <ArrowRight size={11} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2.5">
                <Calendar size={18} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-400">Sem reuniões agendadas</p>
              <Link to="/calendar" className="text-[11px] text-indigo-600 font-semibold mt-1 inline-block hover:underline">
                Agendar agora
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map((m) => {
                const start = new Date(m.startAt)
                return (
                  <div key={m.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-transparent hover:border-indigo-100 transition-all">
                    {/* Badge de data */}
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-white text-[13px] font-bold leading-none">{format(start, 'dd')}</span>
                      <span className="text-indigo-200 text-[9px] uppercase font-bold mt-0.5">
                        {format(start, 'MMM', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{m.title}</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">
                        {format(start, 'HH:mm')}{m.location ? ` · ${m.location}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium tabular-nums flex-shrink-0">
                      {m.attendees?.length || 0}p
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
