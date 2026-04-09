import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

const CURRENT_YEAR = new Date().getFullYear()

const fmt = n => `LKR ${Number(n || 0).toLocaleString('en-LK')}`
const fmtShort = n => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

export default function Analytics() {
  const navigate = useNavigate()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [monthly, setMonthly] = useState(null)
  const [products, setProducts] = useState(null)
  const [trends, setTrends] = useState(null)
  const [customers, setCustomers] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [productTab, setProductTab] = useState('revenue')
  const [suggestions, setSuggestions] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p, t, c] = await Promise.all([
        api.get(`/dashboard/analytics/monthly?year=${year}`).then(r => r.data),
        api.get('/dashboard/analytics/products').then(r => r.data),
        api.get('/dashboard/analytics/trends?days=30').then(r => r.data),
        api.get('/dashboard/analytics/customers').then(r => r.data),
      ])
      setMonthly(m)
      setProducts(p)
      setTrends(t)
      setCustomers(c)
      buildSuggestions(m, p, t, c)
    } catch (e) {
      console.error('Analytics load error:', e)
    } finally { setLoading(false) }
  }, [year])

  useEffect(() => { load() }, [load])

  function buildSuggestions(m, p, t, c) {
    const list = []
    if (!m || !p) return
    const best = m.months.reduce((b, x) => x.revenue > (b?.revenue || 0) ? x : b, null)
    const growth = t?.growthRate || 0
    if (growth < 0) {
      list.push({ type: 'warning', icon: '📉', title: 'Sales dropped ' + Math.abs(growth) + '%', text: `Revenue is down ${Math.abs(growth)}% compared to the first half of this month. Check if stock is low or pricing has changed.`, action: '/products', actionLabel: 'Check Products' })
    } else if (growth > 10) {
      list.push({ type: 'success', icon: '📈', title: 'Sales growing ' + growth + '%!', text: `Great momentum! Revenue grew ${growth}% this month. Keep stock topped up to maintain this.`, action: '/products', actionLabel: 'Check Stock' })
    }
    const lowMargin = p.topByRevenue?.filter(x => x.profitMargin < 15 && x.totalRevenue > 0) || []
    if (lowMargin.length > 0) {
      const lm = lowMargin[0]
      const suggestedPrice = Math.round(lm.totalRevenue / lm.totalQty / 0.75)
      list.push({ type: 'warning', icon: '💰', title: `${lm.productName} — low margin`, text: `"${lm.productName}" has only ${lm.profitMargin}% profit margin. Raising price by LKR ${Math.round(suggestedPrice - lm.totalRevenue / lm.totalQty)} could reach 25% margin.`, action: '/products', actionLabel: 'Edit Price' })
    }
    const top = p.topByRevenue?.[0]
    if (top) {
      list.push({ type: 'opportunity', icon: '📦', title: `Bundle "${top.productName}"`, text: `"${top.productName}" is your #1 product. Try bundling it with accessories — customers who buy phones rarely add cases in the same sale. A bundle deal could raise avg order.`, action: '/billing', actionLabel: 'New Sale' })
    }
    const total = (c?.newVsReturning?.newCustomers || 0) + (c?.newVsReturning?.returningCustomers || 0)
    const retRate = total > 0 ? Math.round((c.newVsReturning.returningCustomers / total) * 100) : 0
    if (retRate < 40 && total > 5) {
      list.push({ type: 'info', icon: '👥', title: `Only ${retRate}% customers return`, text: `Most customers buy once and never return. Send WhatsApp follow-ups 30 days after purchase to bring them back. Repeat customers spend 3× more on average.`, action: '/customers', actionLabel: 'View Customers' })
    }
    const debt = c?.debtSummary?.totalDebt || 0
    if (debt > 10000) {
      list.push({ type: 'warning', icon: '💳', title: `LKR ${fmtShort(debt)} outstanding debt`, text: `${c.debtSummary.customersWithDebt} customers owe a total of ${fmt(debt)}. Follow up to collect payments.`, action: '/customers', actionLabel: 'View Debtors' })
    }
    if (best && best.revenue > 0) {
      const thisMonth = new Date().getMonth() + 1
      if (best.monthNum !== thisMonth) {
        list.push({ type: 'info', icon: '🏆', title: `${best.month} was your best month`, text: `${best.month} ${year} had ${fmt(best.revenue)} revenue with ${best.profitMargin}% margin and ${best.ordersCount} orders. Analyze what made it successful.`, action: '/analytics', actionLabel: 'See Chart' })
      }
    }
    if (list.length === 0) {
      list.push({ type: 'success', icon: '✅', title: 'Everything looks good!', text: 'No urgent issues detected. Keep maintaining your stock levels and follow up with customers regularly.', action: '/dashboard', actionLabel: 'Dashboard' })
    }
    setSuggestions(list)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <span className="material-symbols-outlined animate-spin text-brand text-4xl block">refresh</span>
        <p className="text-white/30 font-mono text-sm">Loading analytics...</p>
      </div>
    </div>
  )

  const yt = monthly?.yearTotal || {}
  const months = monthly?.months || []
  const maxRev = Math.max(...months.map(m => m.revenue), 1)
  const maxPro = Math.max(...months.map(m => m.grossProfit), 1)
  const maxChart = Math.max(maxRev, maxPro)
  const CHART_H = 200
  const CHART_W = 680
  const BAR_GROUP = (CHART_W - 60) / 12
  const BAR_W = Math.floor(BAR_GROUP * 0.35)

  const prodList = productTab === 'revenue'
    ? products?.topByRevenue || []
    : productTab === 'quantity'
    ? products?.topByQuantity || []
    : products?.topByProfit || []

  const maxProd = Math.max(...prodList.map(p =>
    productTab === 'revenue' ? p.totalRevenue :
    productTab === 'quantity' ? p.totalQty :
    p.totalProfit
  ), 1)

  const trendDays = trends?.days || []
  const maxTrend = Math.max(...trendDays.map(d => d.revenue), 1)
  const TREND_W = 500
  const TREND_H = 140

  return (
    <div className="space-y-8 max-w-7xl pb-12 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Sales Analytics</h1>
          <p className="text-white/30 font-mono text-sm mt-1">S R Mobile — Chunnakam</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input w-28 text-sm py-2" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={load} className="btn-ghost py-2 px-4">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <span className="text-white/20 text-xs font-mono">Print: Ctrl+P</span>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Annual Revenue', value: fmt(yt.revenue), icon: 'payments', color: 'brand' },
          { label: 'Annual Profit', value: fmt(yt.profit), icon: 'trending_up', color: 'accent' },
          { label: 'Profit Margin', value: `${yt.profitMargin || 0}%`, icon: 'percent', color: 'brand' },
          { label: 'Total Orders', value: yt.orders || 0, icon: 'receipt_long', color: 'accent' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className={`w-8 h-8 rounded-lg bg-${c.color}/10 flex items-center justify-center mb-2`}>
              <span className={`material-symbols-outlined text-${c.color} text-lg fill-icon`}>{c.icon}</span>
            </div>
            <p className="font-display font-bold text-xl text-white">{c.value}</p>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">{c.label}</p>
          </div>
        ))}
      </div>

      {/* MONTHLY BAR CHART */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Monthly Revenue vs Profit</h2>
            <p className="text-white/30 text-xs font-mono">Click a bar to see details</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand inline-block"/>Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ background: '#4ADE80' }}/>Profit</span>
          </div>
        </div>

        {months.every(m => m.revenue === 0) ? (
          <div className="flex items-center justify-center h-48 text-white/20 font-mono text-sm">No sales data for {year} yet</div>
        ) : (
          <div className="overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${CHART_W} 270`} style={{ minWidth: '400px' }}>
              {[0, 25, 50, 75, 100].map(pct => {
                const y = 20 + CHART_H * (1 - pct / 100)
                return (
                  <g key={pct}>
                    <line x1="50" y1={y} x2={CHART_W - 10} y2={y} stroke="white" strokeOpacity="0.06" strokeDasharray="4 4" />
                    <text x="44" y={y + 4} textAnchor="end" fill="white" fillOpacity="0.3" fontSize="9" fontFamily="monospace">{fmtShort(maxChart * pct / 100)}</text>
                  </g>
                )
              })}
              {months.map((m, i) => {
                const x = 55 + i * BAR_GROUP
                const revH = (m.revenue / maxChart) * CHART_H
                const proH = (m.grossProfit / maxChart) * CHART_H
                const revY = 20 + CHART_H - revH
                const proY = 20 + CHART_H - proH
                const isSelected = selectedMonth?.monthNum === m.monthNum
                return (
                  <g key={i} style={{ cursor: 'pointer' }} onClick={() => setSelectedMonth(selectedMonth?.monthNum === m.monthNum ? null : m)}>
                    <rect x={x} y={revY} width={BAR_W} height={Math.max(revH, 2)} rx="3" fill={isSelected ? '#FFB300' : '#E8A020'} fillOpacity={isSelected ? 1 : 0.85} />
                    <rect x={x + BAR_W + 2} y={proY} width={BAR_W} height={Math.max(proH, 2)} rx="3" fill="#4ADE80" fillOpacity={isSelected ? 1 : 0.7} />
                    <text x={x + BAR_W} y={240} textAnchor="middle" fill="white" fillOpacity="0.4" fontSize="10" fontFamily="monospace">{m.month}</text>
                  </g>
                )
              })}
              <line x1="50" y1="20" x2="50" y2="225" stroke="white" strokeOpacity="0.1" />
            </svg>
          </div>
        )}

        {selectedMonth && (
          <div className="mt-4 p-4 bg-brand/5 border border-brand/20 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-white">{selectedMonth.month} {year}</h3>
              <button onClick={() => setSelectedMonth(null)} className="text-white/30 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Revenue', value: fmt(selectedMonth.revenue) },
                { label: 'Cost of Goods', value: fmt(selectedMonth.costOfGoods) },
                { label: 'Gross Profit', value: fmt(selectedMonth.grossProfit), green: true },
                { label: 'Profit Margin', value: `${selectedMonth.profitMargin}%`, green: selectedMonth.profitMargin > 20 },
                { label: 'Orders', value: selectedMonth.ordersCount },
                { label: 'Avg Order', value: fmt(selectedMonth.avgOrderValue) },
              ].map(item => (
                <div key={item.label} className="bg-surface-high rounded-lg p-3">
                  <p className="text-white/30 text-xs font-mono uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`font-display font-bold text-base ${item.green ? 'text-accent' : 'text-white'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {selectedMonth.topProduct !== '—' && (
              <p className="mt-3 text-white/40 text-xs font-mono">🏆 Top product: {selectedMonth.topProduct}</p>
            )}
          </div>
        )}
      </div>

      {/* TOP PRODUCTS */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-white text-lg mb-4">Top Products</h2>
        <div className="flex gap-2 mb-6">
          {[{ key: 'revenue', label: 'By Revenue' }, { key: 'quantity', label: 'By Units Sold' }, { key: 'profit', label: 'By Profit' }].map(tab => (
            <button key={tab.key} onClick={() => setProductTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-mono border transition-all ${productTab === tab.key ? 'bg-brand/10 border-brand text-brand' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {prodList.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-8 font-mono">No product data yet. Make some sales first.</p>
        ) : (
          <div className="space-y-2">
            {prodList.map((p, i) => {
              const val = productTab === 'revenue' ? p.totalRevenue : productTab === 'quantity' ? p.totalQty : p.totalProfit
              const pct = Math.round((val / maxProd) * 100)
              const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
              return (
                <div key={p.productId} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${i < 3 ? 'bg-brand/5 border border-brand/10' : 'bg-surface-high'}`}>
                  <span className="text-lg w-8 flex-shrink-0 text-center">{rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white text-sm font-body font-medium truncate">{p.productName}</p>
                      <p className="font-mono font-bold text-brand text-sm flex-shrink-0 ml-2">
                        {productTab === 'quantity' ? `${val} units` : fmt(val)}
                      </p>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-white/30 text-xs font-mono">{p.category}</p>
                      <p className="text-white/30 text-xs font-mono">{p.profitMargin}% margin</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 30-DAY TREND */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Last 30 Days Trend</h2>
            <p className="text-white/30 text-xs font-mono">Daily revenue and profit</p>
          </div>
          {trends?.growthRate !== undefined && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${(trends.growthRate || 0) >= 0 ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-400'}`}>
              <span className="material-symbols-outlined text-sm">{(trends.growthRate || 0) >= 0 ? 'trending_up' : 'trending_down'}</span>
              {(trends.growthRate || 0) >= 0 ? '+' : ''}{trends.growthRate}% this month
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {trendDays.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-white/20 font-mono text-sm">No data yet</div>
            ) : (
              <svg width="100%" viewBox={`0 0 ${TREND_W} ${TREND_H + 40}`}>
                {[0, 25, 50, 75, 100].map(pct => (
                  <line key={pct} x1="10" y1={10 + TREND_H * (1 - pct / 100)} x2={TREND_W - 10} y2={10 + TREND_H * (1 - pct / 100)} stroke="white" strokeOpacity="0.05" strokeDasharray="3 3" />
                ))}
                <path
                  d={`M ${trendDays.map((d, i) => {
                    const x = 10 + i * (TREND_W - 20) / (trendDays.length - 1 || 1)
                    const y = 10 + TREND_H * (1 - d.revenue / maxTrend)
                    return `${x},${y}`
                  }).join(' L ')} L ${TREND_W - 10},${TREND_H + 10} L 10,${TREND_H + 10} Z`}
                  fill="#E8A020" fillOpacity="0.08" />
                <polyline
                  points={trendDays.map((d, i) => {
                    const x = 10 + i * (TREND_W - 20) / (trendDays.length - 1 || 1)
                    const y = 10 + TREND_H * (1 - d.revenue / maxTrend)
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none" stroke="#E8A020" strokeWidth="2" strokeLinejoin="round" />
                <polyline
                  points={trendDays.map((d, i) => {
                    const x = 10 + i * (TREND_W - 20) / (trendDays.length - 1 || 1)
                    const y = 10 + TREND_H * (1 - d.revenue / maxTrend) + TREND_H * (d.revenue - d.profit) / maxTrend
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" />
                {trendDays.filter((_, i) => i % 7 === 0).map((d, i) => {
                  const idx = i * 7
                  const x = 10 + idx * (TREND_W - 20) / (trendDays.length - 1 || 1)
                  const label = new Date(d.date).toLocaleDateString('en-LK', { day: '2-digit', month: 'short' })
                  return (
                    <text key={d.date} x={x} y={TREND_H + 30} textAnchor="middle" fill="white" fillOpacity="0.3" fontSize="9" fontFamily="monospace">{label}</text>
                  )
                })}
              </svg>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
                <p className="text-white/30 text-xs font-mono mb-1">Best Day</p>
                <p className="text-accent font-mono font-bold text-sm">{fmt(trends?.bestDay?.revenue || 0)}</p>
                <p className="text-white/20 text-xs font-mono">
                  {trends?.bestDay?.date ? new Date(trends.bestDay.date).toLocaleDateString('en-LK', { day: '2-digit', month: 'short' }) : '—'}
                </p>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <p className="text-white/30 text-xs font-mono mb-1">Worst Day</p>
                <p className="text-red-400 font-mono font-bold text-sm">{fmt(trends?.worstDay?.revenue || 0)}</p>
                <p className="text-white/20 text-xs font-mono">
                  {trends?.worstDay?.date ? new Date(trends.worstDay.date).toLocaleDateString('en-LK', { day: '2-digit', month: 'short' }) : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-3">Customer Insights</p>
            {[
              { label: 'Avg Customer Spend', value: fmt(customers?.avgCustomerValue || 0), icon: 'person' },
              { label: 'Returning Customers', value: customers?.newVsReturning?.returningCustomers || 0, icon: 'replay' },
              { label: 'New Customers', value: customers?.newVsReturning?.newCustomers || 0, icon: 'person_add' },
              { label: 'Outstanding Debt', value: fmt(customers?.debtSummary?.totalDebt || 0), icon: 'credit_card', warn: (customers?.debtSummary?.totalDebt || 0) > 10000 },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-3 p-3 rounded-xl ${item.warn ? 'bg-red-500/5 border border-red-500/10' : 'bg-surface-high'}`}>
                <span className={`material-symbols-outlined text-lg fill-icon ${item.warn ? 'text-red-400' : 'text-brand'}`}>{item.icon}</span>
                <div className="flex-1">
                  <p className="text-white/40 text-xs font-mono">{item.label}</p>
                  <p className={`font-display font-bold text-base ${item.warn ? 'text-red-400' : 'text-white'}`}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUGGESTIONS */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-white text-lg mb-2">💡 Suggestions to Improve Sales</h2>
        <p className="text-white/30 text-xs font-mono mb-5">Auto-generated from your real sales data</p>
        <div className="space-y-3">
          {suggestions.map((s, i) => {
            const borderColor = s.type === 'warning' ? 'border-orange-500' : s.type === 'success' ? 'border-accent' : s.type === 'opportunity' ? 'border-brand' : 'border-blue-400'
            const bgColor = s.type === 'warning' ? 'bg-orange-500/5' : s.type === 'success' ? 'bg-accent/5' : s.type === 'opportunity' ? 'bg-brand/5' : 'bg-blue-400/5'
            return (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border-l-4 ${borderColor} ${bgColor}`}>
                <span className="text-2xl flex-shrink-0 mt-0.5">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-white text-sm mb-1">{s.title}</p>
                  <p className="text-white/50 text-xs font-body leading-relaxed">{s.text}</p>
                </div>
                <button onClick={() => navigate(s.action)} className="btn-ghost py-1.5 px-3 text-xs flex-shrink-0">
                  {s.actionLabel}
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* TOP SPENDERS */}
      {customers?.topSpenders?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-display font-bold text-white text-lg mb-4">Top Customers</h2>
          <div className="space-y-2">
            {customers.topSpenders.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-surface-high rounded-xl cursor-pointer hover:bg-brand/5 transition-colors" onClick={() => navigate(`/customers/${c.id}`)}>
                <span className="text-lg w-8 text-center flex-shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-body font-medium text-sm truncate">{c.name}</p>
                  <p className="text-white/30 text-xs font-mono">{c.phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono font-bold text-brand text-sm">{fmt(c.totalSpent)}</p>
                  <p className="text-white/20 text-xs font-mono">{c.orderCount} orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
