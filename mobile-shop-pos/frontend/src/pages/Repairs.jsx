import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

const STATUSES = ['','RECEIVED','IN_PROGRESS','WAITING_PARTS','READY','DELIVERED']
const STATUS_LABELS = { RECEIVED:'Received',IN_PROGRESS:'In Progress',WAITING_PARTS:'Waiting Parts',READY:'Ready',DELIVERED:'Delivered' }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default function Repairs() {
  const navigate = useNavigate()
  const [repairs, setRepairs] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customerName:'', customerPhone:'', customerWhatsapp:'', whatsappOptIn:false, deviceName:'', issueDescription:'', estimatedCost:'', promisedAt:'', notes:'' })

  const load = () => api.get('/repairs', { params: { status: status || undefined, search: search || undefined } }).then(r => setRepairs(r.data))
  useEffect(() => { load() }, [status, search])

  const saveRepair = async () => {
    setSaving(true)
    try {
      await api.post('/repairs', {
        customerData: { name: form.customerName, phone: form.customerPhone, whatsappNumber: form.customerWhatsapp || form.customerPhone, whatsappOptIn: form.whatsappOptIn },
        deviceName: form.deviceName,
        issueDescription: form.issueDescription,
        estimatedCost: form.estimatedCost || undefined,
        promisedAt: form.promisedAt || undefined,
        notes: form.notes || undefined
      })
      setShowForm(false); load()
    } finally { setSaving(false) }
  }

  const now = new Date()
  const isOverdue = r => r.promisedAt && new Date(r.promisedAt) < now && !['DELIVERED','READY'].includes(r.status)

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Repairs</h1>
          <p className="text-white/30 text-sm font-mono">{repairs.length} records</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><span className="material-symbols-outlined text-sm">add</span>New Repair</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">search</span>
          <input className="input pl-10 text-sm" placeholder="Search device, customer, phone…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all ${status === s ? 'bg-brand/10 border-brand text-brand' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              {['Device','Customer','Status','Estimated','Promised','Notes'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {repairs.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-white/20 font-mono text-sm">No repairs found</td></tr>}
              {repairs.map(r => (
                <tr key={r.id} onClick={() => navigate(`/repairs/${r.id}`)} className={`hover:bg-white/3 cursor-pointer transition-colors ${isOverdue(r) ? 'border-l-2 border-red-500' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-white font-body font-medium">{r.deviceName}</p>
                    <p className="text-white/30 text-xs">{r.issueDescription?.substring(0,40)}{r.issueDescription?.length > 40 ? '…' : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white/70">{r.customer?.name}</p>
                    <p className="text-white/30 text-xs font-mono">{r.customer?.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge status-${r.status.toLowerCase()}`}>{STATUS_LABELS[r.status]}</span>
                    {isOverdue(r) && <p className="text-red-400 text-xs mt-1 font-mono">⚠ Overdue</p>}
                  </td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{r.estimatedCost ? `LKR ${Number(r.estimatedCost).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{r.promisedAt ? new Date(r.promisedAt).toLocaleDateString('en-LK') : '—'}</td>
                  <td className="px-4 py-3 text-white/30 text-xs">{r.notes?.substring(0,30) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Repair Modal */}
      {showForm && (
        <Modal title="New Repair" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <p className="text-white/30 text-xs font-mono uppercase tracking-widest">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name *</label><input className="input" value={form.customerName} onChange={e => setForm(f => ({...f, customerName: e.target.value}))}/></div>
              <div><label className="label">Phone *</label><input className="input" value={form.customerPhone} onChange={e => setForm(f => ({...f, customerPhone: e.target.value}))}/></div>
              <div><label className="label">WhatsApp</label><input className="input" placeholder="Same as phone" value={form.customerWhatsapp} onChange={e => setForm(f => ({...f, customerWhatsapp: e.target.value}))}/></div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-brand" checked={form.whatsappOptIn} onChange={e => setForm(f => ({...f, whatsappOptIn: e.target.checked}))}/>
                  <span className="text-white/50 text-sm">WhatsApp Updates</span>
                </label>
              </div>
            </div>
            <p className="text-white/30 text-xs font-mono uppercase tracking-widest border-t border-white/5 pt-4">Device</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Device Name *</label><input className="input" placeholder="e.g. iPhone 13 Pro" value={form.deviceName} onChange={e => setForm(f => ({...f, deviceName: e.target.value}))}/></div>
              <div className="col-span-2"><label className="label">Issue Description *</label><textarea className="input h-20 resize-none" value={form.issueDescription} onChange={e => setForm(f => ({...f, issueDescription: e.target.value}))}/></div>
              <div><label className="label">Estimated Cost</label><input className="input" type="number" value={form.estimatedCost} onChange={e => setForm(f => ({...f, estimatedCost: e.target.value}))}/></div>
              <div><label className="label">Promise Date</label><input className="input" type="date" value={form.promisedAt} onChange={e => setForm(f => ({...f, promisedAt: e.target.value}))}/></div>
              <div className="col-span-2"><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}/></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={saveRepair} disabled={saving || !form.customerName || !form.customerPhone || !form.deviceName || !form.issueDescription} className="btn-primary flex-1 justify-center">
                {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">build</span>}
                {saving ? 'Saving…' : 'Create Repair'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
