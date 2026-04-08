import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Plus, Search, Pencil, Trash2, X,
  ArrowLeftRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { financialApi } from '../services/api'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import PageError from '../components/ui/PageError'
import useAuthStore from '../store/authStore'

function fmtCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function TypeBadge({ type }) {
  return type === 'RECEITA'
    ? <span className="badge-income"><ArrowUpRight size={9} />Receita</span>
    : <span className="badge-expense"><ArrowDownRight size={9} />Despesa</span>
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function TransactionForm({ transaction, categories, onSave, onClose }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    defaultValues: transaction
      ? { amount: Number(transaction.amount), type: transaction.type,
          description: transaction.description || '', date: transaction.date?.split('T')[0] || '',
          categoryId: transaction.categoryId || '' }
      : { type: 'DESPESA', date: format(new Date(), 'yyyy-MM-dd') },
  })
  const type = watch('type')

  async function onSubmit(data) {
    try {
      const payload = { ...data, amount: Number(data.amount), categoryId: data.categoryId || undefined }
      if (transaction) {
        await financialApi.updateTransaction(transaction.id, payload)
        toast.success('Transação atualizada!')
      } else {
        await financialApi.createTransaction(payload)
        toast.success('Transação criada!')
      }
      onSave()
    } catch (err) {
      const details = err?.response?.data?.error?.details
      toast.error(details?.map((d) => d.message).join(' · ') || err?.response?.data?.error?.message || 'Erro ao salvar')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tipo */}
      <div>
        <label className="label">Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {['RECEITA', 'DESPESA'].map((t) => (
            <label key={t}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-semibold
                ${type === t
                  ? t === 'RECEITA'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`}
            >
              <input type="radio" value={t} className="sr-only" {...register('type')} />
              {t === 'RECEITA' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {t === 'RECEITA' ? 'Receita' : 'Despesa'}
            </label>
          ))}
        </div>
      </div>

      {/* Valor + Data */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor (R$)</label>
          <input type="number" step="0.01" min="0.01" placeholder="0,00"
            className={`input-field ${errors.amount ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/30' : ''}`}
            {...register('amount', {
              required: 'Obrigatório',
              min: { value: 0.01, message: 'Deve ser positivo' },
              max: { value: 9999999999999.99, message: 'Valor máximo excedido' },
              validate: (v) => {
                const num = Number(v)
                return (Math.round(num * 100) / 100 === num) || 'Máximo 2 casas decimais'
              },
            })}
          />
          {errors.amount && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date"
            className={`input-field ${errors.date ? 'border-rose-400' : ''}`}
            {...register('date', { required: 'Obrigatório' })}
          />
          {errors.date && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.date.message}</p>}
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="label">Descrição</label>
        <input type="text" placeholder="Ex: Pagamento de serviço"
          className="input-field" maxLength={255}
          {...register('description', { maxLength: { value: 255, message: 'Máximo 255 caracteres' } })} />
        {errors.description && <p className="text-rose-500 text-[11px] mt-1 font-medium">{errors.description.message}</p>}
      </div>

      {/* Categoria */}
      <div>
        <label className="label">Categoria</label>
        <select className="input-field" {...register('categoryId')}>
          <option value="">Sem categoria</option>
          {categories.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Ações */}
      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={isSubmitting}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-sm
            ${type === 'RECEITA'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}>
          {isSubmitting ? <Spinner size="sm" /> : transaction ? 'Salvar alterações' : 'Criar transação'}
        </button>
      </div>
    </form>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Transactions() {
  const user     = useAuthStore((s) => s.user)
  const canWrite = Boolean(user)

  const [transactions, setTransactions] = useState([])
  const [categories,   setCategories]   = useState([])
  const [pagination,   setPagination]   = useState({ page: 1, total: 0, limit: 15 })
  const [loading,      setLoading]      = useState(true)
  const [filters,      setFilters]      = useState({ type: '', search: '' })

  const [modalOpen,     setModalOpen]     = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error,         setError]         = useState(null)

  const load = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, limit: pagination.limit, ...(filters.type && { type: filters.type }) }
      const { data } = await financialApi.listTransactions(params)
      setTransactions(data.data)
      setPagination((p) => ({ ...p, page, total: data.meta.pagination.total }))
    } catch (err) {
      setError(err)
      toast.error('Erro ao carregar transações')
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.limit])

  useEffect(() => {
    financialApi.listCategories().then((r) => setCategories(r.data.data)).catch(() => {})
  }, [])

  useEffect(() => { load(1) }, [filters]) // eslint-disable-line

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(tx) { setEditing(tx);  setModalOpen(true) }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await financialApi.deleteTransaction(deleting.id)
      toast.success('Transação excluída')
      setDeleting(null)
      load(pagination.page)
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const filtered   = filters.search
    ? transactions.filter((t) =>
        t.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        t.category?.name?.toLowerCase().includes(filters.search.toLowerCase()))
    : transactions

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transações</h2>
          <p className="text-[11.5px] text-slate-400 mt-0.5">
            {pagination.total} registro{pagination.total !== 1 ? 's' : ''} no total
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={14} /> Nova transação
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar nesta página…"
            className="input-field pl-8 py-2 text-[13px]"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="input-field w-auto min-w-36 py-2 text-[13px]"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">Todos os tipos</option>
          <option value="RECEITA">Receitas</option>
          <option value="DESPESA">Despesas</option>
        </select>
        {(filters.type || filters.search) && (
          <button onClick={() => setFilters({ type: '', search: '' })} className="btn-ghost text-[13px] py-2">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {/* Erro */}
      {error && !loading && (
        <PageError error={error} onRetry={() => load(pagination.page)} />
      )}

      {/* Tabela (desktop) + Cards (mobile) */}
      {!error && (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">

        {/* Mobile: cards */}
        <div className="sm:hidden">
          {loading ? (
            <div className="py-16 text-center">
              <Spinner size="lg" className="text-indigo-500 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Nenhuma transação encontrada"
              description={canWrite ? 'Crie a primeira transação clicando em Nova transação.' : 'Sem transações para exibir.'}
              action={canWrite
                ? <button onClick={openCreate} className="btn-primary text-xs">
                    <Plus size={13} /> Nova transação
                  </button>
                : null}
            />
          ) : (
            <div className="divide-y divide-slate-100/80">
              {filtered.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${tx.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {tx.type === 'RECEITA' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 truncate leading-tight">
                      {tx.description || <span className="text-slate-400 italic text-xs">Sem descrição</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10.5px] text-slate-400">{format(new Date(tx.date), 'dd/MM/yyyy')}</span>
                      {tx.category && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10.5px] text-slate-400">{tx.category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[13px] font-bold tabular-nums
                      ${tx.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'RECEITA' ? '+' : '−'}{fmtCurrency(tx.amount)}
                    </p>
                    {canWrite && (
                      <div className="flex items-center justify-end gap-0.5 mt-1">
                        <button onClick={() => openEdit(tx)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setDeleting(tx)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', ''].map((h) => (
                  <th key={h}
                    className="px-4 py-3 text-left text-[10.5px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap first:pl-5 last:pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Spinner size="lg" className="text-indigo-500 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="Nenhuma transação encontrada"
                      description={canWrite ? 'Crie a primeira transação clicando em Nova transação.' : 'Sem transações para exibir.'}
                      action={canWrite
                        ? <button onClick={openCreate} className="btn-primary text-xs">
                            <Plus size={13} /> Nova transação
                          </button>
                        : null}
                    />
                  </td>
                </tr>
              ) : filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3.5 pl-5 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">
                    {format(new Date(tx.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <p className="text-[13px] font-medium text-slate-800 truncate">
                      {tx.description || <span className="text-slate-400 italic text-xs">Sem descrição</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    {tx.category
                      ? <span className="badge-neutral">{tx.category.name}</span>
                      : <span className="text-[11px] text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`text-[13px] font-bold tabular-nums
                      ${tx.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'RECEITA' ? '+' : '−'}{fmtCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 pr-4">
                    {canWrite && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(tx)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleting(tx)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/40">
            <p className="text-[11px] text-slate-500">
              Página {pagination.page} de {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => load(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="btn-secondary text-xs py-1.5 px-3">
                ← Anterior
              </button>
              <button onClick={() => load(pagination.page + 1)}
                disabled={pagination.page >= totalPages || loading}
                className="btn-secondary text-xs py-1.5 px-3">
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Editar transação' : 'Nova transação'}>
        <TransactionForm
          transaction={editing}
          categories={categories}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={() => { setModalOpen(false); setEditing(null); load(pagination.page) }}
        />
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir transação" size="sm">
        <div className="space-y-4">
          <p className="text-[13px] text-slate-600 leading-relaxed">
            Tem certeza que deseja excluir esta transação? A ação não pode ser desfeita.
          </p>
          {deleting && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[12.5px] font-semibold text-slate-700">{deleting.description || 'Sem descrição'}</p>
              <p className={`text-[12.5px] font-bold mt-0.5 tabular-nums
                ${deleting.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmtCurrency(deleting.amount)}
              </p>
            </div>
          )}
          <div className="flex gap-2.5">
            <button onClick={() => setDeleting(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleDelete} disabled={deleteLoading} className="btn-danger flex-1">
              {deleteLoading ? <Spinner size="sm" /> : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
