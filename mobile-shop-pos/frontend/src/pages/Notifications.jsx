import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data)).finally(() => setLoading(false))
  }, [])

  const statusColor = s => s === 'SENT' ? 'bg-accent/10 text-accent border-accent/20' : s === 'FAILED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-brand/10 text-brand border-brand/20'

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">WhatsApp Messages</h1>
        <p className="text-white/30 text-sm font-mono">{notifications.length} records</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><span className="material-symbols-outlined animate-spin text-brand text-3xl">refresh</span></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Customer','Template','Type','Status','Sent At'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {notifications.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-10 text-white/20 font-mono text-sm">No messages sent yet</td></tr>
                )}
                {notifications.map(n => (
                  <tr key={n.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-body font-medium">{n.customer?.name}</p>
                      <p className="text-white/30 text-xs font-mono">{n.customer?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-white/50 font-mono text-xs">{n.templateName}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-white/5 text-white/40 border-white/10">{n.messageType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColor(n.status)}`}>{n.status}</span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">
                      {n.sentAt ? new Date(n.sentAt).toLocaleString('en-LK') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
