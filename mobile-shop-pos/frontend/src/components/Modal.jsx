export default function Modal({ title, onClose, children, width = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-surface rounded-2xl border border-white/10 w-full ${width} max-h-[90vh] overflow-y-auto animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
