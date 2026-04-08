export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3.5">
          <Icon size={20} className="text-slate-400" />
        </div>
      )}
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="text-[11.5px] text-slate-400 mt-1 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
