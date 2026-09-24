import api from '../api/client'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '' })
  const [setup, setSetup] = useState(false)
  useEffect(() => { api.get('/auth/setup-status').then(r => setSetup(r.data.required)).catch(() => {}) }, [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (setup && form.password.length < 12) return setError('Choose a password with at least 12 characters.')
    if (setup && form.password !== form.confirm) return setError('The two passwords do not match.')
    setLoading(true)
    try {
      if (setup) { await api.post('/auth/setup', { username: form.username, displayName: form.displayName, password: form.password }); setSetup(false) }
      await login(form.username, form.password)
      navigate('/', { replace: true })
    } catch (err) {
      if (!err.response) setError('Cannot reach the POS service. Please restart SR Mobile POS.')
      else setError(err.response?.data?.error || 'Invalid username or password')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface-lowest flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/5 rounded-full blur-[100px] pointer-events-none"/>
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-[80px] pointer-events-none"/>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex w-16 h-16 bg-brand/10 border border-brand/20 rounded-2xl items-center justify-center mb-6">
            <span className="material-symbols-outlined text-brand text-3xl fill-icon">storefront</span>
          </div>
          <h1 className="font-display font-black text-3xl text-white tracking-tight">S R Mobile</h1>
          <p className="text-white/50 font-mono text-sm mt-1 uppercase tracking-widest">Chunnakam · POS System</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={submit} className="space-y-5">
            {setup && (
              <div>
                <h2 className="font-display font-bold text-lg text-white">Create the owner account</h2>
                <p className="text-white/60 text-sm mt-1">The owner can use everything and can add staff logins later. Choose a password with at least 12 characters.</p>
              </div>
            )}
            {setup && (
              <div>
                <label className="label">Your name</label>
                <input className="input" placeholder="e.g. Kowshigan" value={form.displayName} onChange={set('displayName')} maxLength={60} />
              </div>
            )}
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/40 text-lg">person</span>
                <input className="input pl-10" autoComplete="username" autoCapitalize="none" placeholder={setup ? 'e.g. owner' : 'Username'}
                  value={form.username} onChange={set('username')} required />
              </div>
              {setup && <p className="text-white/50 text-xs mt-1">Letters, numbers, dot, dash or underscore (3-64 characters).</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/40 text-lg">lock</span>
                <input className="input pl-10" type="password" autoComplete={setup ? 'new-password' : 'current-password'} placeholder="••••••••"
                  value={form.password} onChange={set('password')} required />
              </div>
            </div>
            {setup && (
              <div>
                <label className="label">Confirm password</label>
                <input className="input" type="password" autoComplete="new-password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="material-symbols-outlined text-red-400 text-lg">error</span>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
              {loading ? <span className="material-symbols-outlined animate-spin text-lg">refresh</span> : <span className="material-symbols-outlined text-lg">login</span>}
              {loading ? 'Please wait...' : setup ? 'Create Owner Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 font-mono text-xs mt-6">
          Station Road · Sivan Kovil Opposite · Chunnakam<br/>
          0765 733 434
        </p>
      </div>
    </div>
  )
}
