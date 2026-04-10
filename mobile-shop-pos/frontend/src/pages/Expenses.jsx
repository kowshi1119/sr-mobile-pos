import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

const CATEGORY_COLORS = {
  Rent: '#E8A020',
  Salary: '#4ADE80',
  Electricity: '#06B6D4',
  Internet: '#A78BFA',
  Supplies: '#F97316',
  Marketing: '#EC4899',
  Maintenance: '#22C55E',
  Transport: '#F59E0B',
  Other: '#94A3B8'
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [total, setTotal] = useState(0)
  const [monthly, setMonthly] = useState([])
  const [categories, setCategories] = useState([])
  const [activeTab, setActiveTab] = useState('this')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [monthValue, setMonthValue] = useState(new Date().toISOString().slice(0, 7))
  const [showModal, setShowModal] = useState(false)
  const [targetForm, setTargetForm] = useState({ amount: '', notes: '' })
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10) })

  const currentYear = Number(monthValue.slice(0, 4))
  const currentMonth = Number(monthValue.slice(5, 7))

  const getRange = () => {
    const now = new Date()
    if (activeTab === 'last') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
    }
    const [year, month] = monthValue.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }

  const load = () => {
    const { from, to } = getRange()
    api.get('/expenses', { params: { from, to, category: selectedCategory || undefined } }).then(r => {
      setExpenses(r.data.expenses || [])
      setTotal(r.data.total || 0)
    }).catch(() => {
      setExpenses([])
      setTotal(0)
    })

    api.get(`/expenses/summary/monthly?year=${currentYear}`).then(r => setMonthly(r.data || [])).catch(() => setMonthly([]))
    api.get('/expenses/categories').then(r => setCategories(r.data || [])).catch(() => {})
    api.get(`/targets?year=${currentYear}&month=${currentMonth}`).then(r => setTarget(r.data)).catch(() => setTarget(null))
  }

  useEffect(() => { load() }, [activeTab, selectedCategory, monthValue])

  const thisMonthTotal = monthly.find(m => m.monthNum === new Date().getMonth() + 1)?.total || 0
  const lastMonthNum = new Date().getMonth() === 0 ? 12 : new Date().getMonth()
  const lastMonthTotal = monthly.find(m => m.monthNum === lastMonthNum)?.total || 0
  const yearTotal = monthly.reduce((s, m) => s + Number(m.total || 0), 0)

  const breakdown = useMemo(() => {
    const map = {}
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0)
    })
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const addExpense = async () => {
    if (!form.category || !form.amount) return alert('Category and amount are required')
    try {
      await api.post('/expenses', form)
      setShowModal(false)
      setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10) })
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to add expense')
    }
  }

  const deleteExpense = async id => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Delete failed')
    }
  }

  const saveTarget = async () => {
    if (!targetForm.amount) return alert('Enter a target amount')
    await api.post('/targets', {
      year: currentYear,
      month: currentMonth,
      targetAmount: parseFloat(targetForm.amount),
      notes: targetForm.notes
    })
    alert('Target saved!')
    setTargetForm({ amount: '', notes: '' })
    load()
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Expenses</h1>
          <p className="text-white/30 text-sm font-mono">Track business expenses and monthly targets</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-display font-bold text-brand">LKR {thisMonthTotal.toLocaleString()}</p><p className="label">This Month Total</p></div>
        <div className="stat-card"><p className="text-2xl font-display font-bold text-accent">LKR {lastMonthTotal.toLocaleString()}</p><p className="label">Last Month Total</p></div>
        <div className="stat-card"><p className="text-2xl font-display font-bold text-white">LKR {yearTotal.toLocaleString()}</p><p className="label">Year Total</p></div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'this', label: 'This Month' },
              { key: 'last', label: 'Last Month' },
              { key: 'custom', label: 'Custom' }
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-lg text-xs font-mono border transition-all ${activeTab === tab.key ? 'bg-brand/10 border-brand text-brand' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <input type="month" className="input text-sm" value={monthValue} onChange={e => { setMonthValue(e.target.value); setActiveTab('custom') }} />
            <select className="input text-sm min-w-36" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-4 border-brand/20 bg-brand/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-white">Set Monthly Target</h3>
              <p className="text-white/30 text-xs font-mono">Current progress: {target?.hasTarget ? `${target.progress}%` : 'No target yet'}</p>
            </div>
            {target?.hasTarget && <span className="badge bg-accent/10 text-accent border-accent/20">LKR {Number(target.targetAmount || 0).toLocaleString()}</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="input" type="number" placeholder="Target amount" value={targetForm.amount} onChange={e => setTargetForm(f => ({ ...f, amount: e.target.value }))} />
            <input className="input md:col-span-2" placeholder="Notes (optional)" value={targetForm.notes} onChange={e => setTargetForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <button onClick={saveTarget} className="btn-primary py-2 px-4 text-sm">
            <span className="material-symbols-outlined text-sm">flag</span>
            Save Target
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-bold text-white">Expense List</h2>
          <span className="font-mono text-brand text-sm">LKR {total.toLocaleString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Date', 'Category', 'Description', 'Amount', 'Delete'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {expenses.length === 0 && (
                <tr><td colSpan="5" className="text-center py-10 text-white/20 font-mono">No expenses found</td></tr>
              )}
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white/40 text-xs">{new Date(exp.date).toLocaleDateString('en-LK')}</td>
                  <td className="px-4 py-3">
                    <span className="badge text-xs border-0" style={{ background: `${CATEGORY_COLORS[exp.category] || '#94A3B8'}20`, color: CATEGORY_COLORS[exp.category] || '#94A3B8' }}>
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{exp.description}</td>
                  <td className="px-4 py-3 font-mono font-bold text-brand">LKR {Number(exp.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteExpense(exp.id)} className="btn-ghost py-1.5 px-2 text-red-400 hover:text-red-300">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-display font-bold text-white">Category Breakdown</h2>
        {breakdown.length === 0 && <p className="text-white/20 text-sm font-mono">No expense data yet.</p>}
        {breakdown.map(item => {
          const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0
          const color = CATEGORY_COLORS[item.category] || '#94A3B8'
          return (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70 font-body">{item.category}</span>
                <span className="font-mono text-white/50">LKR {item.amount.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Modal title="Add Expense" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Amount (LKR)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={addExpense} className="btn-primary flex-1 justify-center">
                <span className="material-symbols-outlined text-sm">save</span>
                Save Expense
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
