import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

const STATUS_LABELS = { RECEIVED:'Received',IN_PROGRESS:'In Progress',WAITING_PARTS:'Waiting Parts',READY:'Ready for Pickup',DELIVERED:'Delivered' }
const STATUS_ORDER = ['RECEIVED','IN_PROGRESS','WAITING_PARTS','READY','DELIVERED']

export default function RepairDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [repair, setRepair] = useState(null)
  const [notes, setNotes] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => api.get(`/repairs/${id}`).then(r => { setRepair(r.data); setNotes(r.data.notes || ''); setActualCost(r.data.actualCost || '') })
  useEffect(() => { load() }, [id])

  const changeStatus = async (status) => {
    if (!confirm(`Change status to "${STATUS_LABELS[status]}"?`)) return
    setSaving(true)
    try {
      await api.patch(`/repairs/${id}/status`, { status, actualCost: status === 'DELIVERED' ? actualCost : undefined })
      load()
    } finally { setSaving(false) }
  }

  const saveNotes = async () => {
    setSaving(true)
    try { await api.patch(`/repairs/${id}`, { notes, actualCost: actualCost ? parseFloat(actualCost) : undefined }); load() }
    finally { setSaving(false) }
  }

  if (!repair) return <div className="flex items-center justify-center h-64"><span className="material-symbols-outlined animate-spin text-brand text-3xl">refresh</span></div>

  const now = new Date()
  const isOverdue = repair.promisedAt && new Date(repair.promisedAt) < now && !['DELIVERED','READY'].includes(repair.status)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/repairs')} className="btn-ghost py-2 px-3"><span className="material-symbols-outlined text-sm">arrow_back</span></button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-2xl text-white">{repair.deviceName}</h1>
          <p className="text-white/30 text-sm font-mono">{repair.customer?.name} · {repair.customer?.phone}</p>
        </div>
        <span className={`badge status-${repair.status.toLowerCase()} text-sm px-3 py-1`}>{STATUS_LABELS[repair.status]}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main detail */}
        <div className="lg:col-span-2 space-y-5">
          {/* Status control */}
          <div className="card p-5">
            <p className="label mb-3">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_ORDER.map(s => (
                <button key={s} onClick={() => changeStatus(s)} disabled={saving || repair.status === s}
                  className={`px-4 py-2 rounded-lg text-xs font-mono border transition-all ${repair.status === s ? 'bg-brand/10 border-brand text-brand' : 'border-white/10 text-white/40 hover:border-brand/40 hover:text-brand disabled:opacity-30'}`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {repair.status === 'READY' && repair.customer?.whatsappOptIn && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-lg">
                <svg className="w-4 h-4 text-[#25D366] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                <p className="text-[#25D366] text-xs font-mono">WhatsApp notification was sent to customer</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="label">Issue</p><p className="text-white/70 text-sm">{repair.issueDescription}</p></div>
              <div><p className="label">Collected</p><p className="text-white/70 text-sm">{new Date(repair.collectedAt).toLocaleDateString('en-LK')}</p></div>
              <div>
                <p className="label">Estimated Cost</p>
                <p className="text-white/70 text-sm font-mono">{repair.estimatedCost ? `LKR ${Number(repair.estimatedCost).toLocaleString()}` : '—'}</p>
              </div>
              <div>
                <p className="label">Promised Date</p>
                <p className={`text-sm font-mono ${isOverdue ? 'text-red-400' : 'text-white/70'}`}>
                  {repair.promisedAt ? new Date(repair.promisedAt).toLocaleDateString('en-LK') : '—'}
                  {isOverdue && ' ⚠ Overdue'}
                </p>
              </div>
            </div>
            <div>
              <label className="label">Actual Cost (LKR)</label>
              <input className="input" type="number" placeholder="Enter actual cost on delivery" value={actualCost} onChange={e => setActualCost(e.target.value)}/>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-24 resize-none" value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
            <button onClick={saveNotes} disabled={saving} className="btn-primary">
              {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">save</span>}Save Notes
            </button>
          </div>
        </div>

        {/* Customer sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="label mb-3">Customer</p>
            <p className="font-display font-bold text-white">{repair.customer?.name}</p>
            <p className="text-white/40 font-mono text-sm mt-1">{repair.customer?.phone}</p>
            {repair.customer?.whatsappOptIn && (
              <span className="badge bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 mt-2">WhatsApp opted in</span>
            )}
          </div>

          {repair.customer?.sales?.length > 0 && (
            <div className="card p-5">
              <p className="label mb-3">Purchase History</p>
              <div className="space-y-2">
                {repair.customer.sales.map(s => (
                  <div key={s.id} className="p-3 bg-surface-low rounded-lg">
                    <p className="font-mono text-brand text-xs">{s.invoiceNumber}</p>
                    <p className="text-white/50 text-xs">{s.items?.map(i => i.product?.name).join(', ')}</p>
                    <p className="text-white/30 text-xs mt-0.5 font-mono">LKR {Number(s.totalAmount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
