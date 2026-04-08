import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      if (!err.response) setError('Cannot reach the API server. Please check that the backend is running.')
      else setError(err.response?.data?.error || 'Invalid email or password')
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
          <p className="text-white/30 font-mono text-sm mt-1 uppercase tracking-widest">Chunnakam · POS System</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Admin Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">alternate_email</span>
                <input className="input pl-10" type="email" placeholder="admin@srmobile.lk"
                  value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">lock</span>
                <input className="input pl-10" type="password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="material-symbols-outlined text-red-400 text-lg">error</span>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
              {loading ? <span className="material-symbols-outlined animate-spin text-lg">refresh</span> : <span className="material-symbols-outlined text-lg">login</span>}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 font-mono text-xs mt-6">
          Station Road · Sivan Kovil Opposite · Chunnakam<br/>
          0765 733 434
        </p>
      </div>
    </div>
  )
}
