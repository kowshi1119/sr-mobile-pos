import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function Customers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debtorsOnly, setDebtorsOnly] = useState(false)

  useEffect(() => {
    api.get('/customers', { params: { search: search || undefined } }).then(r => setCustomers(r.data))
  }, [search])

  const displayed = debtorsOnly ? customers.filter(c => Number(c.totalDebt) > 0) : customers

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Customers</h1>
          <p className="text-white/30 text-sm font-mono">{displayed.length} records</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">search</span>
          <input className="input pl-10" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setDebtorsOnly(v => !v)}
          className={`btn-ghost py-2 px-4 text-sm border transition-all ${debtorsOnly ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-white/10 text-white/50'}`}
        >
          <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
          Debtors Only
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Name','Phone','WhatsApp','Debt','Sales','Repairs','Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayed.length === 0 && (
                <tr><td colSpan="7" className="text-center py-10 text-white/20 font-mono text-sm">No customers found</td></tr>
              )}
              {displayed.map(c => (
                <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="hover:bg-white/3 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-body font-medium">{c.name}</p>
                  </td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3">
                    {c.whatsappOptIn
                      ? <span className="badge bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20">Opted In</span>
                      : <span className="text-white/20 text-xs font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {Number(c.totalDebt) > 0
                      ? <span className="text-red-400 font-mono font-bold text-sm">LKR {Number(c.totalDebt).toLocaleString()}</span>
                      : <span className="text-white/20 text-xs font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3 text-accent font-mono text-sm">{c._count?.sales || 0}</td>
                  <td className="px-4 py-3 text-brand font-mono text-sm">{c._count?.repairs || 0}</td>
                  <td className="px-4 py-3 text-white/30 text-xs">{new Date(c.createdAt).toLocaleDateString('en-LK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
