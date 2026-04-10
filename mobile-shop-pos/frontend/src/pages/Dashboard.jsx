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
  const [debtors, setDebtors] = useState([])
  const [target, setTarget] = useState(null)
  const [upgradeCandidates, setUpgradeCandidates] = useState([])
  const [warrantyExpiring, setWarrantyExpiring] = useState([])
  const [summaryPreview, setSummaryPreview] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary').then(r => setSummary(r.data)),
      api.get('/dashboard/low-stock').then(r => setLowStock(r.data)),
      api.get('/dashboard/pending-repairs').then(r => setPendingRepairs(r.data)),
      api.get('/dashboard/recent-sales').then(r => setRecentSales(r.data)),
      api.get('/dashboard/top-products').then(r => setTopProducts(r.data)),
      api.get('/debt').then(r => setDebtors(r.data)),
      api.get(`/targets?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`).then(r => setTarget(r.data)).catch(() => {}),
      api.get('/reminders/upgrade-candidates').then(r => setUpgradeCandidates(r.data)).catch(() => {}),
      api.get('/reminders/warranty-expiring').then(r => setWarrantyExpiring(r.data)).catch(() => {}),
      api.get('/whatsapp-summary/preview').then(r => setSummaryPreview(r.data)).catch(() => {})
    ]).catch(console.error)
  }, [])

  const sendDailySummary = async () => {
    try {
      const { data } = await api.post('/whatsapp-summary/send')
      if (data.sent) {
        alert('Daily summary sent to owner WhatsApp!')
      } else {
        alert('Failed to send. Check WhatsApp config.')
      }
    } catch (e) {
      alert(e.response?.data?.error || 'Send failed')
    }
  }

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

      {target && (
        <div className="card p-5 col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand fill-icon">flag</span>
              <h3 className="font-display font-bold text-white">Monthly Target</h3>
            </div>
            <div className="text-right">
              <p className="font-mono text-brand font-bold">LKR {Number(target.actualAmount).toLocaleString()}</p>
              <p className="text-white/30 text-xs font-mono">of LKR {Number(target.targetAmount).toLocaleString()} target</p>
            </div>
          </div>
          {target.hasTarget ? (
            <>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${target.progress >= 100 ? 'bg-accent' : target.progress >= 70 ? 'bg-brand' : 'bg-orange-500'}`} style={{ width: `${Math.min(target.progress, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className={`text-sm font-mono font-bold ${target.progress >= 100 ? 'text-accent' : target.progress >= 70 ? 'text-brand' : 'text-orange-400'}`}>
                  {target.progress}% achieved
                </p>
                {target.progress < 70 && <p className="text-orange-400 text-xs font-mono animate-pulse">⚠ Behind target</p>}
                {target.progress >= 100 && <p className="text-accent text-xs font-mono">🎉 Target reached!</p>}
              </div>
            </>
          ) : (
            <button onClick={() => navigate('/expenses')} className="text-brand/50 text-xs font-mono hover:text-brand transition-colors">
              Set monthly target →
            </button>
          )}
        </div>
      )}

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

          {(upgradeCandidates.length > 0 || warrantyExpiring.length > 0) && (
            <div className="card p-5">
              <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-brand fill-icon">notifications_active</span>
                Customer Reminders
              </h2>

              {upgradeCandidates.length > 0 && (
                <div className="mb-4">
                  <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-2">📱 Upgrade Opportunities ({upgradeCandidates.length})</p>
                  <div className="space-y-2">
                    {upgradeCandidates.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-surface-high rounded-xl">
                        <div>
                          <p className="text-white text-sm font-body font-medium">{c.customerName}</p>
                          <p className="text-white/30 text-xs font-mono">Bought {c.products?.[0] || 'a phone'} — 11mo ago</p>
                        </div>
                        {c.optIn && <span className="badge bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 text-xs">WA Ready</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {warrantyExpiring.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-2">🛡 Warranty Expiring Soon ({warrantyExpiring.length})</p>
                  <div className="space-y-2">
                    {warrantyExpiring.slice(0, 3).map((w, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-surface-high rounded-xl">
                        <div>
                          <p className="text-white text-sm font-body font-medium">{w.customerName}</p>
                          <p className="text-white/30 text-xs font-mono">{w.productName} — {w.daysLeft}d left</p>
                        </div>
                        <span className={`badge text-xs ${w.daysLeft < 7 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-brand/10 text-brand border-brand/20'}`}>
                          {w.daysLeft}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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

          {/* Outstanding Debts */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 fill-icon">account_balance_wallet</span>
                <h2 className="font-display font-bold text-white">Outstanding Debts</h2>
              </div>
              {debtors.length > 0 && (
                <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">{debtors.length}</span>
              )}
            </div>
            <div className="divide-y divide-white/5">
              {debtors.length === 0 && <p className="text-white/30 text-sm p-5 text-center font-mono">No outstanding debts</p>}
              {debtors.map(c => (
                <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 cursor-pointer transition-colors">
                  <div>
                    <p className="text-white text-sm font-body">{c.name}</p>
                    <p className="text-white/30 text-xs font-mono">{c.phone}</p>
                  </div>
                  <p className="text-red-400 font-mono font-bold text-sm">LKR {Number(c.totalDebt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {summaryPreview && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              </svg>
              Daily WhatsApp Summary
            </h3>
            <button onClick={sendDailySummary} className="btn-primary py-2 px-4 text-sm">
              <span className="material-symbols-outlined text-sm fill-icon">send</span>
              Send Now
            </button>
          </div>
          <div className="bg-surface-low rounded-xl p-4 font-mono text-xs text-white/60 whitespace-pre-line border border-white/5">
            {summaryPreview.message}
          </div>
          <p className="text-white/20 text-xs font-mono mt-2">Add OWNER_WHATSAPP_NUMBER to .env to enable sending</p>
        </div>
      )}
    </div>
  )
}
