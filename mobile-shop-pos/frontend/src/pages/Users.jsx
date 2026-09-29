import { useEffect, useState } from 'react'
import api from '../api/client'
import Modal from '../components/Modal'
import { showAlert, askConfirm } from '../dialogs'

const emptyForm = { username: '', displayName: '', password: '', permissions: [] }

function PermissionPicker({ groups, presets, value, onChange }) {
  const toggle = key => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  const toggleGroup = group => {
    const keys = group.items.map(([key]) => key)
    const all = keys.every(k => value.includes(k))
    onChange(all ? value.filter(k => !keys.includes(k)) : [...new Set([...value, ...keys])])
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-white/60 text-sm">Quick start:</span>
        {Object.entries(presets).map(([name, keys]) => (
          <button type="button" key={name} className="btn-ghost py-1.5 px-3 text-sm" onClick={() => onChange(keys)}>{name}</button>
        ))}
        <button type="button" className="btn-ghost py-1.5 px-3 text-sm" onClick={() => onChange([])}>Clear all</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {groups.map(group => {
          const keys = group.items.map(([key]) => key)
          const all = keys.every(k => value.includes(k))
          return (
            <fieldset key={group.name} className="rounded-xl border border-white/10 p-4">
              <legend className="px-1 flex items-center gap-2">
                <span className="font-display font-bold text-white text-sm">{group.name}</span>
                <button type="button" className="text-xs text-brand hover:underline" onClick={() => toggleGroup(group)}>{all ? 'None' : 'All'}</button>
              </legend>
              <div className="space-y-2 mt-1">
                {group.items.map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2.5 text-sm text-white/80 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--color-brand))]" checked={value.includes(key)} onChange={() => toggle(key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [catalog, setCatalog] = useState({ groups: [], presets: {} })
  const [editing, setEditing] = useState(null) // null = closed, {} = new user, user object = edit
  const [form, setForm] = useState(emptyForm)
  const [resetFor, setResetFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/users').then(r => setUsers(r.data))
  useEffect(() => {
    load()
    api.get('/users/permissions').then(r => setCatalog(r.data))
  }, [])

  const openNew = () => { setForm({ ...emptyForm, permissions: catalog.presets.Cashier || [] }); setError(''); setEditing({}) }
  const openEdit = u => { setForm({ username: u.username, displayName: u.displayName, password: '', permissions: u.permissions }); setError(''); setEditing(u) }

  const save = async e => {
    e.preventDefault()
    setError('')
    const isNew = !editing.id
    if (!form.displayName.trim()) return setError('Enter the staff member\'s name.')
    if (isNew && form.password.length < 8) return setError('The password needs at least 8 characters.')
    setSaving(true)
    try {
      if (isNew) await api.post('/users', form)
      else await api.patch(`/users/${editing.id}`, { displayName: form.displayName, permissions: form.permissions })
      setEditing(null); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this user.')
    } finally { setSaving(false) }
  }

  const setActive = async (u, isActive) => {
    if (!isActive && !await askConfirm(`Disable ${u.displayName}? They will be signed out and cannot sign in until you enable them again.`)) return
    try { await api.patch(`/users/${u.id}`, { isActive }); load() }
    catch (err) { showAlert(err.response?.data?.error || 'Could not update this user.') }
  }

  const remove = async u => {
    if (!await askConfirm(`Delete ${u.displayName} (${u.username})? Past sales keep their name.`)) return
    try { await api.delete(`/users/${u.id}`); load() }
    catch (err) { showAlert(err.response?.data?.error || 'Could not delete this user.') }
  }

  const resetPassword = async e => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) return setError('The password needs at least 8 characters.')
    setSaving(true)
    try {
      await api.post(`/users/${resetFor.id}/password`, { password: newPassword })
      setResetFor(null); setNewPassword('')
      showAlert('Password changed. Give the new password to the staff member.')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the password.')
    } finally { setSaving(false) }
  }

  const permissionCount = u => u.role === 'OWNER' ? 'Everything' : `${u.permissions.length} permission${u.permissions.length === 1 ? '' : 's'}`

  return (
    <div className="relative z-10 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Users &amp; Permissions</h1>
          <p className="text-white/60 text-sm">Create a login for each staff member and choose exactly what they can do.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><span className="material-symbols-outlined text-sm">person_add</span>Add Staff</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/60 border-b border-white/10">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Access</th>
              <th className="px-5 py-3 font-medium">Last sign-in</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(u => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                <td className="px-5 py-3 text-white font-medium">{u.displayName}</td>
                <td className="px-5 py-3 text-white/70 font-mono">{u.username}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${u.role === 'OWNER' ? 'bg-brand/15 text-brand border-brand/30' : 'bg-white/5 text-white/70 border-white/10'}`}>{u.role === 'OWNER' ? 'Owner' : 'Staff'}</span>
                  {!u.isActive && <span className="badge ml-2 bg-red-500/10 text-red-400 border-red-500/20">Disabled</span>}
                </td>
                <td className="px-5 py-3 text-white/70">{permissionCount(u)}</td>
                <td className="px-5 py-3 text-white/60">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                <td className="px-5 py-3">
                  {u.role === 'OWNER' ? (
                    <p className="text-white/50 text-xs text-right">Use “Change Password” in the menu</p>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => openEdit(u)}>Permissions</button>
                      <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => { setResetFor(u); setNewPassword(''); setError('') }}>Reset password</button>
                      <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => setActive(u, !u.isActive)}>{u.isActive ? 'Disable' : 'Enable'}</button>
                      <button className="btn-ghost py-1.5 px-3 text-xs text-red-400" onClick={() => remove(u)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-white/60">Loading users…</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? `Permissions for ${editing.displayName}` : 'Add staff member'} onClose={() => setEditing(null)} width="max-w-3xl">
          <form onSubmit={save} className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.displayName} maxLength={60} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="e.g. Kumar" required />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" value={form.username} disabled={!!editing.id} autoCapitalize="none" autoComplete="off" onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. cashier1" required />
              </div>
              {!editing.id && (
                <div>
                  <label className="label">Password (8+ characters)</label>
                  <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                </div>
              )}
            </div>
            <PermissionPicker groups={catalog.groups} presets={catalog.presets} value={form.permissions} onChange={permissions => setForm(f => ({ ...f, permissions }))} />
            <p className="text-white/50 text-xs">Changes apply immediately, even if the staff member is already signed in. Restore, import, reset and user management always stay with the owner.</p>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editing.id ? 'Save permissions' : 'Create login'}</button>
            </div>
          </form>
        </Modal>
      )}

      {resetFor && (
        <Modal title={`Reset password for ${resetFor.displayName}`} onClose={() => setResetFor(null)} width="max-w-md">
          <form onSubmit={resetPassword} className="space-y-4">
            <p className="text-white/70 text-sm">They will be signed out and must use the new password.</p>
            <div><label className="label">New password (8+ characters)</label><input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></div>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setResetFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Set password'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
