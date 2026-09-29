import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function ChangePassword({ onClose }) {
  const { isOwner, setSession } = useAuth()
  const min = isOwner ? 12 : 8
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < min) return setError(`The new password needs at least ${min} characters.`)
    if (form.newPassword !== form.confirm) return setError('The two new passwords do not match.')
    setSaving(true)
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
      setSession(data.token, data.user)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the password.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Change password" onClose={onClose} width="max-w-md">
      {done ? (
        <div className="space-y-4">
          <p className="text-white/80">Your password was changed. Use the new password next time you sign in.</p>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} required /></div>
          <div><label className="label">New password (at least {min} characters)</label><input className="input" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} required /></div>
          <div><label className="label">Confirm new password</label><input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required /></div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
