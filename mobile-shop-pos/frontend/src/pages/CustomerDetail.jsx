import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = () => api.get(`/customers/${id}`).then(r => { setCustomer(r.data); setForm({ name: r.data.name, whatsappOptIn: r.data.whatsappOptIn }) })
  useEffect(() => { load() }, [id])

  const save = async () => {
    setSaving(true)
    try { await api.patch(`/customers/${id}`, form); setEditing(false); load() }
    finally { setSaving(false) }
  }

  if (!customer) return <div className="flex items-center justify-center h-64"><span className="material-symbols-outlined animate-spin text-brand text-3xl">refresh</span></div>

  const totalSpent = customer.sales?.reduce((s, x) => s + Number(x.totalAmount), 0) || 0

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/customers')} className="btn-ghost py-2 px-3"><span className="material-symbols-outlined text-sm">arrow_back</span></button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-2xl text-white">{customer.name}</h1>
          <p className="text-white/30 text-sm font-mono">{customer.phone}</p>
        </div>
        <button onClick={() => setEditing(v => !v)} className="btn-ghost py-2 px-4">
          <span className="material-symbols-outlined text-sm">edit</span> Edit
        </button>
      </div>

      {editing && (
        <div className="card p-5 border-brand/20 animate-slide-up space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/></div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-brand" checked={form.whatsappOptIn} onChange={e => setForm(f => ({...f, whatsappOptIn: e.target.checked}))}/>
                <span className="text-white/60 text-sm">WhatsApp Updates</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">save</span>}Save
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-display font-bold text-brand">{customer.sales?.length || 0}</p><p className="label">Total Sales</p></div>
        <div className="stat-card"><p className="text-2xl font-display font-bold text-white">LKR {totalSpent.toLocaleString()}</p><p className="label">Total Spent</p></div>
        <div className="stat-card"><p className="text-2xl font-display font-bold text-accent">{customer.repairs?.length || 0}</p><p className="label">Repairs</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales */}
        <div className="card">
          <div className="px-5 py-4 border-b border-white/5"><h2 className="font-display font-bold text-white">Purchase History</h2></div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {customer.sales?.length === 0 && <p className="text-white/20 text-sm p-5 text-center font-mono">No purchases yet</p>}
            {customer.sales?.map(s => (
              <div key={s.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-brand text-sm">{s.invoiceNumber}</p>
                  <p className="font-display font-bold text-white text-sm">LKR {Number(s.totalAmount).toLocaleString()}</p>
                </div>
                <p className="text-white/30 text-xs mt-0.5">{s.items?.map(i => i.product?.name).join(', ')}</p>
                <p className="text-white/20 text-xs">{new Date(s.createdAt).toLocaleDateString('en-LK')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Repairs */}
        <div className="card">
          <div className="px-5 py-4 border-b border-white/5"><h2 className="font-display font-bold text-white">Repair History</h2></div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {customer.repairs?.length === 0 && <p className="text-white/20 text-sm p-5 text-center font-mono">No repairs yet</p>}
            {customer.repairs?.map(r => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-body font-medium text-sm">{r.deviceName}</p>
                  <span className={`badge status-${r.status.toLowerCase()} text-xs`}>{r.status.replace('_',' ')}</span>
                </div>
                <p className="text-white/30 text-xs mt-0.5">{r.issueDescription?.substring(0,50)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
