import Spinner from './Spinner'

export default function PageLoading({ message = 'Carregando…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <Spinner size="lg" className="text-indigo-500 mb-3" />
      <p className="text-[13px] text-slate-400 font-medium">{message}</p>
    </div>
  )
}
