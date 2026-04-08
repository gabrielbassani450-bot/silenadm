import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'

export default function PageError({ error, onRetry, message }) {
  const isNetwork = error?.message?.includes('Network') || error?.code === 'ERR_NETWORK'

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
        isNetwork ? 'bg-amber-50' : 'bg-rose-50'
      }`}>
        {isNetwork
          ? <WifiOff size={24} className="text-amber-500" />
          : <AlertTriangle size={24} className="text-rose-500" />}
      </div>

      <h3 className="text-[15px] font-bold text-slate-800 mb-1">
        {isNetwork ? 'Sem conexão' : 'Algo deu errado'}
      </h3>

      <p className="text-[13px] text-slate-500 max-w-xs leading-relaxed mb-5">
        {message || (isNetwork
          ? 'Verifique sua conexão com a internet e tente novamente.'
          : 'Não foi possível carregar os dados. Tente novamente em instantes.')}
      </p>

      {onRetry && (
        <button onClick={onRetry} className="btn-secondary gap-2">
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      )}
    </div>
  )
}
