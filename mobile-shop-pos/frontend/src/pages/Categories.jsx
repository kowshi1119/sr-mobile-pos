import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Categories() {
  const [cats, setCats] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name:'', icon:'', warrantyMonths:3 })
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/categories').then(r => setCats(r.data))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEdit(null); setForm({ name:'', icon:'', warrantyMonths:3 }); setShowForm(true) }
  const openEdit = c => { setEdit(c); setForm({ name: c.name, icon: c.icon || '', warrantyMonths: c.warrantyMonths }); setShowForm(true) }

  const save = async () => {
    setSaving(true)
    try {
      if (edit) await api.patch(`/categories/${edit.id}`, form)
      else await api.post('/categories', form)
      setShowForm(false); load()
    } finally { setSaving(false) }
  }

  const toggle = async (c) => { await api.patch(`/categories/${c.id}`, { isActive: !c.isActive }); load() }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display font-bold text-2xl text-white">Categories</h1>
          <p className="text-white/30 text-sm font-mono">{cats.length} categories</p></div>
        <button onClick={openAdd} className="btn-primary"><span className="material-symbols-outlined text-sm">add</span>Add Category</button>
      </div>

      {showForm && (
        <div className="card p-5 border-brand/20 animate-slide-up space-y-4">
          <h3 className="font-display font-bold text-white">{edit ? 'Edit Category' : 'New Category'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Category Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Smartphones"/>
            </div>
            <div>
              <label className="label">Icon (Material Symbol)</label>
              <input className="input font-mono" value={form.icon} onChange={e => setForm(f => ({...f, icon: e.target.value}))} placeholder="smartphone"/>
            </div>
            <div>
              <label className="label">Default Warranty (Months)</label>
              <input className="input" type="number" value={form.warrantyMonths} onChange={e => setForm(f => ({...f, warrantyMonths: parseInt(e.target.value)}))}/>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={save} disabled={saving || !form.name} className="btn-primary flex-1 justify-center">
              {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">save</span>}Save
            </button>
          </div>
        </div>
      )}

      <div className="card divide-y divide-white/5">
        {cats.length === 0 && <p className="text-white/30 text-sm p-6 text-center font-mono">No categories yet. Add one above.</p>}
        {cats.map(c => (
          <div key={c.id} className={`flex items-center justify-between px-5 py-4 ${!c.isActive ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-brand text-lg">{c.icon || 'category'}</span>
              </div>
              <div>
                <p className="font-body font-medium text-white">{c.name}</p>
                <p className="text-white/30 text-xs font-mono">{c._count?.products || 0} products · {c.warrantyMonths}mo warranty</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!c.isActive && <span className="badge bg-white/5 text-white/30 border-white/10">Inactive</span>}
              <button onClick={() => openEdit(c)} className="btn-ghost py-1.5 px-3 text-xs"><span className="material-symbols-outlined text-sm">edit</span></button>
              <button onClick={() => toggle(c)} className={`btn-ghost py-1.5 px-3 text-xs ${c.isActive ? 'text-red-400' : 'text-accent'}`}>
                <span className="material-symbols-outlined text-sm">{c.isActive ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
