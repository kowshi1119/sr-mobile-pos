import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/client'

export default function SaleSuccess() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [fullSale, setFullSale] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!state?.sale) { navigate('/billing'); return }
    api.get(`/sales/${state.sale.id}`)
      .then(r => setFullSale(r.data))
      .catch(() => setFullSale(state.sale))
      .finally(() => setLoading(false))
  }, [])

  if (!state?.sale) return null
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="material-symbols-outlined animate-spin text-brand text-3xl">refresh</span>
    </div>
  )

  const sale = fullSale || state.sale
  const { invoiceNumber, qrDataUrl } = state
  const subtotal = sale.items?.reduce((s, i) => s + (Number(i.unitPrice) * i.quantity), 0) || Number(sale.totalAmount)

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-accent text-2xl fill-icon">check_circle</span>
          </div>
          <div>
            <h1 className="font-display font-black text-xl text-white">Sale Complete!</h1>
            <p className="text-white/30 font-mono text-xs">{invoiceNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-ghost py-2 px-4">
            <span className="material-symbols-outlined text-sm">print</span> Print
          </button>
          <button onClick={() => navigate('/billing')} className="btn-primary py-2 px-4">
            <span className="material-symbols-outlined text-sm fill-icon">add</span> New Sale
          </button>
        </div>
      </div>

      <div className="print-receipt bg-white text-black rounded-xl overflow-hidden border border-white/5">
        <div className="p-8 text-center border-b border-gray-200">
          <h2 className="font-display font-black text-3xl tracking-widest text-brand">S R MOBILE</h2>
          <p className="text-gray-500 text-sm mt-1 tracking-wider">MOBILE SHOP — CHUNNAKAM</p>
          <div className="mt-3 space-y-0.5 text-sm text-gray-600">
            <p>Station Road, Sivan Kovil Opposite, Chunnakam</p>
            <p>Tel: 0765 733 434</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6 bg-gray-50 border-b border-gray-200">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Invoice</p>
              <p className="font-mono font-bold text-lg text-brand">{invoiceNumber}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {new Date(sale.createdAt).toLocaleString('en-LK', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Payment</p>
              <p className="font-mono font-semibold text-gray-800">{sale.paymentMethod}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Customer</p>
              <p className="font-bold text-gray-800 text-base">{sale.customer?.name || 'Walk-in Customer'}</p>
              {sale.customer?.phone && sale.customer.phone !== '0000000000' && (
                <p className="text-gray-500 text-sm">{sale.customer.phone}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Served By</p>
              <p className="text-gray-600 text-sm">Admin — Main Branch</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Product</th>
                <th className="text-center py-3 text-xs font-bold uppercase tracking-widest text-gray-400 w-12">Qty</th>
                <th className="text-right py-3 text-xs font-bold uppercase tracking-widest text-gray-400 w-28">Unit Price</th>
                <th className="text-right py-3 text-xs font-bold uppercase tracking-widest text-gray-400 w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items?.map((item, i) => (
                <tr key={i}>
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-gray-800 leading-tight">
                      {item.product?.name}{item.variant ? ` — ${item.variant.variantName}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 font-mono uppercase">
                      SKU: {item.product?.sku}{item.imei ? ` | IMEI: ${item.imei.imei}` : ''}
                    </p>
                  </td>
                  <td className="py-4 text-center font-mono text-gray-700">{String(item.quantity).padStart(2,'0')}</td>
                  <td className="py-4 text-right font-mono text-gray-700">{Number(item.unitPrice).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
                  <td className="py-4 text-right font-mono font-bold text-gray-800">{(Number(item.unitPrice)*item.quantity).toLocaleString('en-LK',{minimumFractionDigits:2})}</td>
                </tr>
              ))}
              {(!sale.items || sale.items.length === 0) && (
                <tr><td colSpan="4" className="py-6 text-center text-gray-400 text-xs">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            {sale.warrantyRecords?.length > 0 && (
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-brand mb-3">Warranty Certificate</p>
                <div className="space-y-2">
                  {sale.warrantyRecords.map((w, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-500">
                      <span>{w.product?.name}:</span>
                      <span className="font-bold text-gray-700">Valid until {new Date(w.expiresAt).toLocaleDateString('en-LK',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs italic text-gray-400">Retain this receipt for warranty claims.</p>
              </div>
            )}
            <div className="w-full md:w-60 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span className="font-mono">{subtotal.toLocaleString('en-LK',{minimumFractionDigits:2})}</span>
              </div>
              {Number(sale.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({sale.discountType})</span>
                  <span className="font-mono">- {Number(sale.discountAmount).toLocaleString('en-LK',{minimumFractionDigits:2})}</span>
                </div>
              )}
              <div className="pt-3 border-t-2 border-gray-800 flex justify-between items-baseline">
                <span className="font-bold text-sm uppercase tracking-tight text-gray-800">Net Total (LKR)</span>
                <span className="font-display font-black text-2xl text-brand">{Number(sale.totalAmount).toLocaleString('en-LK',{minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 text-center border-t border-gray-200">
          {qrDataUrl && (
            <div className="inline-block p-3 bg-white border-2 border-gray-200 rounded-xl mb-3">
              <img src={qrDataUrl} alt="Invoice QR" className="w-28 h-28"/>
            </div>
          )}
          <p className="text-gray-500 text-xs tracking-wide mb-6">Scan to view your digital invoice</p>
          <div className="border-t border-dashed border-gray-200 pt-6 space-y-1">
            <p className="font-display font-bold text-base text-brand italic">"Thank you for choosing S R Mobile!"</p>
            <p className="text-gray-400 text-xs">Station Road · Sivan Kovil Opposite · Chunnakam</p>
            <p className="text-gray-400 text-xs">Tel: 0765 733 434</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 no-print pb-6">
        <button onClick={() => window.print()} className="btn-ghost flex-1 justify-center py-3">
          <span className="material-symbols-outlined">print</span> Print Receipt
        </button>
        <button onClick={() => navigate(`/invoice/${invoiceNumber}`)} className="btn-ghost flex-1 justify-center py-3">
          <span className="material-symbols-outlined">open_in_new</span> View Invoice
        </button>
        <button onClick={() => navigate('/billing')} className="btn-primary flex-1 justify-center py-3">
          <span className="material-symbols-outlined fill-icon">add_shopping_cart</span> New Sale
        </button>
      </div>
    </div>
  )
}
