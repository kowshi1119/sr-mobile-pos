import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function AiWidget() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your shop assistant. Ask me to find products, check repairs, or navigate anywhere." }
  ])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const QUICK = [
    { label: 'Low Stock', query: 'show low stock items' },
    { label: 'Pending Repairs', query: 'show pending repairs' },
    { label: 'Today Sales', query: 'open today sales' },
  ]

  const send = async (q) => {
    const text = q || query.trim()
    if (!text) return
    setQuery('')
    setMessages(m => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { query: text })
      let responseText = `Intent: ${data.intent}`

      // Execute action
      if (data.action === 'open_page') {
        const page = data.parameters?.page
        const section = data.parameters?.section
        navigate(`/${page}${section ? `#${section}` : ''}`)
        responseText = `Navigating to ${page}...`
      } else if (data.action === 'search_products') {
        navigate(`/products?search=${encodeURIComponent(data.parameters?.query || '')}`)
        responseText = `Searching products for "${data.parameters?.query}"...`
      } else if (data.action === 'search_customer') {
        navigate(`/customers?search=${encodeURIComponent(data.parameters?.phone || '')}`)
        responseText = `Finding customer ${data.parameters?.phone}...`
      }

      setMessages(m => [...m, { role: 'ai', text: responseText, data }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Sorry, I ran into an error. Please try again.' }])
    } finally { setLoading(false) }
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  if (!open) return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:9999 }}>
      <button onClick={() => setOpen(true)} className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/30 hover:scale-105 active:scale-95 transition-all">
        <span className="material-symbols-outlined text-onbrand text-2xl fill-icon">smart_toy</span>
      </button>
    </div>
  )

  return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:9999, maxWidth:'320px', width:'320px' }}>
    <div className="w-full h-[500px] flex flex-col bg-surface rounded-2xl border border-white/10 shadow-2xl animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-onbrand text-base fill-icon">smart_toy</span>
          </div>
          <div>
            <p className="font-display font-bold text-sm text-brand">AI Assistant</p>
            <p className="text-[10px] text-accent font-mono uppercase">Online</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm font-body leading-relaxed ${
              m.role === 'user'
                ? 'bg-brand/20 text-brand border border-brand/20'
                : 'bg-surface-high text-white/80 border border-white/5'
            }`}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-high border border-white/5 px-4 py-2 rounded-xl">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay:'0ms' }}/>
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay:'150ms' }}/>
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay:'300ms' }}/>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick actions */}
      <div className="px-3 pb-2 flex gap-2 flex-wrap">
        {QUICK.map(q => (
          <button key={q.label} onClick={() => send(q.query)} className="px-2.5 py-1 bg-surface-high rounded-lg text-xs text-white/50 hover:text-brand hover:bg-brand/10 border border-white/5 transition-all font-mono">
            {q.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex gap-2">
          <input
            className="input text-sm py-2 flex-1"
            placeholder="Ask anything..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button onClick={() => send()} disabled={loading} className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-brand-dark active:scale-95 transition-all disabled:opacity-40">
            <span className="material-symbols-outlined text-onbrand text-lg fill-icon">auto_awesome</span>
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
