import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'

export default function SaleSuccess() {
  const { state } = useLocation()
  const navigate = useNavigate()

  useEffect(() => { if (!state?.sale) navigate('/billing') }, [state])
  if (!state?.sale) return null

  const { sale, invoiceNumber, qrDataUrl } = state

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      {/* Success banner */}
      <div className="flex flex-col items-center text-center py-8 no-print">
        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-accent text-4xl fill-icon">check_circle</span>
        </div>
        <h1 className="font-display font-black text-3xl text-white">Sale Complete!</h1>
        <p className="text-white/40 font-mono mt-1">{invoiceNumber}</p>
        <p className="text-brand font-display font-bold text-xl mt-2">LKR {Number(sale.totalAmount).toLocaleString()}</p>
      </div>

      {/* Receipt (also used for print) */}
      <div className="card p-0 overflow-hidden print-receipt">
        {/* Shop Header */}
        <div className="p-8 text-center border-b border-white/5 print:border-gray-200">
          <h2 className="font-display font-black text-2xl text-brand tracking-widest">S R MOBILE</h2>
          <p className="text-white/40 text-sm mt-1">Station Road, Sivan Kovil Opposite, Chunnakam</p>
          <p className="text-white/30 text-xs mt-0.5">Tel: 0765 733 434</p>
        </div>
        {/* Invoice Info */}
        <div className="p-6 grid grid-cols-2 gap-6 border-b border-white/5">
          <div>
            <p className="label">Invoice</p>
            <p className="font-mono text-brand font-bold">{invoiceNumber}</p>
            <p className="text-white/30 text-xs mt-1">{new Date(sale.createdAt).toLocaleString('en-LK')}</p>
          </div>
          <div>
            <p className="label">Payment</p>
            <p className="font-mono text-white font-medium">{sale.paymentMethod}</p>
          </div>
        </div>
        {/* QR */}
        <div className="p-6 flex flex-col items-center border-b border-white/5">
          {qrDataUrl && <img src={qrDataUrl} alt="Invoice QR" className="w-32 h-32 bg-white p-2 rounded-xl"/>}
          <p className="text-white/30 text-xs mt-2 font-mono">Scan to view digital invoice</p>
        </div>
        <div className="p-6 text-center">
          <p className="text-brand font-display font-bold text-lg italic">"Thank you for choosing S R Mobile!"</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 no-print">
        <button onClick={() => window.print()} className="btn-ghost flex-1 justify-center py-3">
          <span className="material-symbols-outlined">print</span> Print Receipt
        </button>
        <button onClick={() => navigate('/billing')} className="btn-primary flex-1 justify-center py-3">
          <span className="material-symbols-outlined fill-icon">add_shopping_cart</span> New Sale
        </button>
      </div>
    </div>
  )
}
