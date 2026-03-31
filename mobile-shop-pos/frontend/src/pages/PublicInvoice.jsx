import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'

export default function PublicInvoice() {
  const { invoiceNumber } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`${API}/invoice/${invoiceNumber}`)
      .then(r => setData(r.data))
      .catch(() => setError('Invoice not found'))
      .finally(() => setLoading(false))
  }, [invoiceNumber])

  if (loading) return (
    <div className="min-h-screen bg-surface-lowest flex items-center justify-center">
      <span className="material-symbols-outlined text-brand text-4xl animate-spin">refresh</span>
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-surface-lowest flex items-center justify-center text-white/50">{error}</div>
  )

  const { sale, repair } = data
  const REPAIR_LABELS = { RECEIVED:'Received',IN_PROGRESS:'In Progress',WAITING_PARTS:'Waiting Parts',READY:'Ready for Pickup',DELIVERED:'Delivered' }

  return (
    <div className="min-h-screen bg-surface-lowest p-4 flex justify-center">
      <div className="w-full max-w-lg space-y-0 my-8">
        {/* Shop Header */}
        <div className="bg-brand px-8 py-8 rounded-t-2xl text-center">
          <h1 className="font-display font-black text-3xl text-onbrand tracking-widest">S R MOBILE</h1>
          <p className="text-onbrand/70 text-sm mt-1">Station Road, Sivan Kovil Opposite, Chunnakam</p>
          <p className="text-onbrand/50 text-xs mt-0.5">0765 733 434</p>
        </div>

        <div className="bg-surface rounded-b-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {/* Invoice Meta */}
          <div className="p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="label">Invoice</p>
              <p className="font-mono text-brand font-bold text-lg">{sale.invoiceNumber}</p>
            </div>
            <div>
              <p className="label">Date</p>
              <p className="text-white text-sm">{new Date(sale.createdAt).toLocaleDateString('en-LK', { day:'2-digit', month:'short', year:'numeric' })}</p>
            </div>
            <div>
              <p className="label">Customer</p>
              <p className="text-white font-body font-medium">{sale.customer?.name}</p>
            </div>
            <div>
              <p className="label">Payment</p>
              <p className="text-white font-mono">{sale.paymentMethod}</p>
            </div>
          </div>

          {/* Items */}
          <div className="p-6">
            <p className="label mb-3">Items Purchased</p>
            <div className="space-y-3">
              {sale.items?.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-white text-sm font-body font-medium">{item.product?.name}</p>
                    {item.imei && <p className="text-white/30 text-xs font-mono">IMEI: {item.imei.imei}</p>}
                    <p className="text-white/20 text-xs font-mono">{item.product?.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs">{item.quantity}×</p>
                    <p className="text-white font-mono font-bold text-sm">LKR {(Number(item.unitPrice) * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="p-6 flex items-center justify-between">
            <span className="font-display font-bold text-white/50 uppercase tracking-wider text-sm">Total</span>
            <span className="font-display font-black text-brand text-2xl">LKR {Number(sale.totalAmount).toLocaleString()}</span>
          </div>

          {/* Warranty */}
          {sale.warrantyRecords?.length > 0 && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-accent text-lg fill-icon">verified_user</span>
                <p className="label m-0">Warranty Coverage</p>
              </div>
              <div className="space-y-2">
                {sale.warrantyRecords.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-3 bg-accent/5 border border-accent/20 rounded-lg">
                    <div>
                      <p className="text-white text-sm">{w.product?.name}</p>
                      <p className="text-accent text-xs font-mono">{w.warrantyMonths} months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/30 text-xs">Expires</p>
                      <p className="text-white text-sm font-mono">{new Date(w.expiresAt).toLocaleDateString('en-LK')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Repair */}
          {repair && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-brand text-lg">build</span>
                <p className="label m-0">Active Repair</p>
              </div>
              <div className="p-4 bg-brand/5 border border-brand/20 rounded-lg">
                <p className="text-white font-body font-medium">{repair.deviceName}</p>
                <p className="text-white/40 text-xs mt-1">{repair.issueDescription}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className={`badge status-${repair.status.toLowerCase()}`}>{REPAIR_LABELS[repair.status]}</span>
                  {repair.promisedAt && <p className="text-white/30 text-xs font-mono">Ready by: {new Date(repair.promisedAt).toLocaleDateString('en-LK')}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="p-6 text-center">
            <a href="https://wa.me/94765733434" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-[#25D366] font-body font-medium text-sm hover:bg-[#25D366]/20 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat with S R Mobile
            </a>
            <p className="text-white/20 text-xs mt-4 font-mono">Station Road · Sivan Kovil Opposite · Chunnakam</p>
          </div>
        </div>
      </div>
    </div>
  )
}
