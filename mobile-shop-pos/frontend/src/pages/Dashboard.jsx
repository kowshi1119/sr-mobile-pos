import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

function StatCard({ icon, label, value, sub, color = 'brand' }) {
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center mb-2`}>
        <span className={`material-symbols-outlined text-${color} text-lg fill-icon`}>{icon}</span>
      </div>
      <p className="text-2xl font-display font-bold text-white">{value ?? '—'}</p>
      <p className="text-white/40 text-xs font-mono uppercase tracking-wider">{label}</p>
      {sub && <p className="text-white/20 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

const STATUS_COLORS = { RECEIVED:'blue',IN_PROGRESS:'yellow',WAITING_PARTS:'orange',READY:'accent',DELIVERED:'surface-high' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [pendingRepairs, setPendingRepairs] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [topProducts, setTopProducts] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary').then(r => setSummary(r.data)),
      api.get('/dashboard/low-stock').then(r => setLowStock(r.data)),
      api.get('/dashboard/pending-repairs').then(r => setPendingRepairs(r.data)),
      api.get('/dashboard/recent-sales').then(r => setRecentSales(r.data)),
      api.get('/dashboard/top-products').then(r => setTopProducts(r.data)),
    ]).catch(console.error)
  }, [])

  const now = new Date()
  const isOverdue = r => r.promisedAt && new Date(r.promisedAt) < now && r.status !== 'DELIVERED' && r.status !== 'READY'

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Title */}
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Dashboard</h1>
        <p className="text-white/30 text-sm font-mono">{now.toLocaleDateString('en-LK', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="payments" label="Today's Revenue" value={`LKR ${(summary?.todaySales || 0).toLocaleString()}`} />
        <StatCard icon="receipt_long" label="Sales Today" value={summary?.todaySalesCount ?? 0} color="accent" />
        <StatCard icon="person_add" label="New Customers" value={summary?.newCustomers ?? 0} color="brand" />
        <StatCard icon="build" label="Repairs In" value={summary?.newRepairs ?? 0} color="brand" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="xl:col-span-2 space-y-6">
          {/* Low Stock */}
          {lowStock.length > 0 && (
            <div className="card" id="low-stock">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-400 fill-icon">warning</span>
                  <h2 className="font-display font-bold text-white">Low Stock Alert</h2>
                  <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">{lowStock.length}</span>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {lowStock.map(p => (
                  <div key={p.id} onClick={() => navigate('/products')} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 cursor-pointer transition-colors">
                    <div>
                      <p className="font-body text-sm text-white">{p.name}</p>
                      <p className="font-mono text-xs text-white/30">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-mono font-bold text-sm">{Number(p.stockQuantity)}</p>
                      <p className="text-white/20 text-xs">threshold: {Number(p.lowStockThreshold)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Sales */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="font-display font-bold text-white">Recent Sales</h2>
              <button onClick={() => navigate('/billing')} className="text-brand text-xs font-mono hover:underline">+ New Sale</button>
            </div>
            <div className="divide-y divide-white/5">
              {recentSales.length === 0 && <p className="text-white/30 text-sm p-5 text-center font-mono">No sales yet today</p>}
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
                  <div>
                    <p className="font-mono text-brand text-sm">{s.invoiceNumber}</p>
                    <p className="text-white/50 text-xs">{s.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-white text-sm">LKR {Number(s.totalAmount).toLocaleString()}</p>
                    <p className="text-white/30 text-xs">{new Date(s.createdAt).toLocaleTimeString('en-LK', { hour:'2-digit', minute:'2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-6">
          {/* Pending Repairs */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="font-display font-bold text-white">Pending Repairs</h2>
              <span className="badge bg-brand/10 text-brand border border-brand/20">{pendingRepairs.length}</span>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {pendingRepairs.length === 0 && <p className="text-white/30 text-sm p-5 text-center font-mono">All clear!</p>}
              {pendingRepairs.map(r => (
                <div key={r.id} onClick={() => navigate(`/repairs/${r.id}`)} className={`px-5 py-3 hover:bg-white/3 cursor-pointer transition-colors ${isOverdue(r) ? 'border-l-2 border-red-500' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white text-sm font-body">{r.deviceName}</p>
                    <span className={`badge status-${r.status.toLowerCase()}`}>{r.status.replace('_',' ')}</span>
                  </div>
                  <p className="text-white/30 text-xs">{r.customer?.name}</p>
                  {isOverdue(r) && <p className="text-red-400 text-xs mt-0.5 font-mono">⚠ Overdue</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="card">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="font-display font-bold text-white">Top Products This Month</h2>
            </div>
            <div className="divide-y divide-white/5">
              {topProducts.length === 0 && <p className="text-white/30 text-sm p-5 text-center font-mono">No data yet</p>}
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-display font-bold text-2xl text-white/10 w-6">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate font-body">{p.name}</p>
                    <p className="text-accent text-xs font-mono">{p.unitsSold} units sold</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
