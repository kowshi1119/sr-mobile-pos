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

  // Debt state
  const [debtData, setDebtData] = useState({ records: [], totalDebt: 0 })
  const [debtLoading, setDebtLoading] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [creditModal, setCreditModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', description: '' })
  const [creditForm, setCreditForm] = useState({ amount: '', description: '' })
  const [debtSaving, setDebtSaving] = useState(false)

  const load = () => api.get(`/customers/${id}`).then(r => { setCustomer(r.data); setForm({ name: r.data.name, phone: r.data.phone || '', whatsappNumber: r.data.whatsappNumber || '', whatsappOptIn: r.data.whatsappOptIn }) })
  const loadDebt = () => {
    setDebtLoading(true)
    api.get(`/debt/${id}`).then(r => setDebtData(r.data)).catch(() => {}).finally(() => setDebtLoading(false))
  }
  useEffect(() => { load(); loadDebt() }, [id])

  const save = async () => {
    setSaving(true)
    try { await api.patch(`/customers/${id}`, form); setEditing(false); load() }
    finally { setSaving(false) }
  }

  const recordPayment = async () => {
    const amount = parseFloat(payForm.amount)
    if (!amount || amount <= 0) { alert('Enter a valid amount'); return }
    setDebtSaving(true)
    try {
      await api.post('/debt', { customerId: id, type: 'PAYMENT', amount, description: payForm.description || 'Payment received' })
      setPayModal(false); setPayForm({ amount: '', description: '' })
      loadDebt(); load()
    } catch (e) { alert(e.response?.data?.error || 'Failed') } finally { setDebtSaving(false) }
  }

  const addCredit = async () => {
    const amount = parseFloat(creditForm.amount)
    if (!amount || amount <= 0) { alert('Enter a valid amount'); return }
    setDebtSaving(true)
    try {
      await api.post('/debt', { customerId: id, type: 'CREDIT', amount, description: creditForm.description || 'Manual credit' })
      setCreditModal(false); setCreditForm({ amount: '', description: '' })
      loadDebt(); load()
    } catch (e) { alert(e.response?.data?.error || 'Failed') } finally { setDebtSaving(false) }
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
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}/></div>
            <div><label className="label">WhatsApp Number</label><input className="input" value={form.whatsappNumber} onChange={e => setForm(f => ({...f, whatsappNumber: e.target.value}))}/></div>
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

      {/* Outstanding Debt Banner */}
      {Number(debtData.totalDebt) > 0 && (
        <div className="card p-5 border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-xs font-mono uppercase tracking-wider mb-1">Outstanding Debt</p>
              <p className="text-red-400 font-display font-black text-3xl">LKR {Number(debtData.totalDebt).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPayModal(true)} className="btn-ghost border-red-500/30 text-red-400 hover:bg-red-500/10 py-2 px-3 text-sm">
                <span className="material-symbols-outlined text-sm">payments</span> Record Payment
              </button>
              <button onClick={() => setCreditModal(true)} className="btn-ghost py-2 px-3 text-sm">
                <span className="material-symbols-outlined text-sm">add</span> Add Credit
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Debt History */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-display font-bold text-white">Debt History</h2>
          <div className="flex gap-2">
            <button onClick={() => setPayModal(true)} className="btn-ghost py-1.5 px-3 text-sm text-red-400 border-red-500/20 hover:bg-red-500/10">
              <span className="material-symbols-outlined text-sm">payments</span> Record Payment
            </button>
            <button onClick={() => setCreditModal(true)} className="btn-ghost py-1.5 px-3 text-sm">
              <span className="material-symbols-outlined text-sm">add</span> Add Credit
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {debtLoading ? (
            <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-brand text-2xl">refresh</span></div>
          ) : debtData.records?.length === 0 ? (
            <p className="text-white/20 text-sm p-5 text-center font-mono">No debt records</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date','Description','Amount','Type','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {debtData.records?.map(r => (
                  <tr key={r.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white/40 text-xs">{new Date(r.createdAt).toLocaleDateString('en-LK')}</td>
                    <td className="px-4 py-3 text-white/70 text-xs max-w-48 truncate">{r.description || (r.sale?.invoiceNumber ? `Invoice ${r.sale.invoiceNumber}` : '—')}</td>
                    <td className="px-4 py-3 font-mono font-bold text-sm">
                      <span className={r.type === 'CREDIT' ? 'text-red-400' : 'text-accent'}>
                        {r.type === 'CREDIT' ? '+' : '-'}LKR {Number(r.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${r.type === 'CREDIT' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-accent/10 text-accent border-accent/20'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.isPaid
                        ? <span className="badge bg-white/5 text-white/30 border-white/10 text-xs">Paid</span>
                        : <span className="badge bg-red-500/10 text-red-400 border-red-500/20 text-xs">Unpaid</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(false)}>
          <div className="bg-surface rounded-2xl border border-white/10 w-80 p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-white mb-4">Record Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Amount (LKR)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} autoFocus/>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Cash payment received…" value={payForm.description} onChange={e => setPayForm(f => ({...f, description: e.target.value}))}/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPayModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={recordPayment} disabled={debtSaving} className="btn-primary flex-1 justify-center bg-accent hover:bg-accent/90">
                {debtSaving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">check</span>}Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setCreditModal(false)}>
          <div className="bg-surface rounded-2xl border border-white/10 w-80 p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-white mb-4">Add Credit</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Amount (LKR)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={creditForm.amount} onChange={e => setCreditForm(f => ({...f, amount: e.target.value}))} autoFocus/>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Reason for credit…" value={creditForm.description} onChange={e => setCreditForm(f => ({...f, description: e.target.value}))}/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreditModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={addCredit} disabled={debtSaving} className="btn-primary flex-1 justify-center">
                {debtSaving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">add</span>}Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
