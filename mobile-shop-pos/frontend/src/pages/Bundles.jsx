import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

const emptyForm = {
  name: '',
  description: '',
  bundlePrice: '',
  items: [{ productId: '', quantity: 1 }]
}

export default function Bundles() {
  const [bundles, setBundles] = useState([])
  const [products, setProducts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/bundles').then(r => setBundles(r.data)).catch(() => setBundles([]))
    api.get('/products').then(r => setProducts(r.data)).catch(() => setProducts([]))
  }

  useEffect(() => { load() }, [])

  const addItemRow = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', quantity: 1 }] }))
  const removeItemRow = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItemRow = (idx, patch) => setForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, ...patch } : item) }))

  const originalTotal = useMemo(() => form.items.reduce((s, item) => {
    const product = products.find(p => p.id === item.productId)
    return s + (Number(product?.sellingPrice || 0) * (Number(item.quantity) || 0))
  }, 0), [form.items, products])

  const savings = originalTotal - (Number(form.bundlePrice) || 0)

  const saveBundle = async () => {
    const items = form.items.filter(i => i.productId)
    if (!form.name || !form.bundlePrice || items.length === 0) {
      return alert('Name, price, and at least one product are required')
    }
    setSaving(true)
    try {
      await api.post('/bundles', {
        name: form.name,
        description: form.description,
        bundlePrice: Number(form.bundlePrice),
        items: items.map(i => ({ productId: i.productId, quantity: Number(i.quantity) || 1 }))
      })
      setShowModal(false)
      setForm(emptyForm)
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save bundle')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async bundle => {
    try {
      await api.patch(`/bundles/${bundle.id}`, { isActive: !bundle.isActive })
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update bundle')
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Bundles</h1>
          <p className="text-white/30 text-sm font-mono">Create product combo offers and savings packs</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Bundle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bundles.length === 0 && (
          <div className="card p-6 text-center text-white/20 font-mono">No bundles yet. Create one to get started.</div>
        )}
        {bundles.map(bundle => {
          const original = bundle.items?.reduce((s, item) => s + (Number(item.product?.sellingPrice || 0) * Number(item.quantity || 0)), 0) || 0
          const save = original - Number(bundle.bundlePrice || 0)
          return (
            <div key={bundle.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-white">{bundle.name}</h2>
                  <p className="text-white/30 text-sm">{bundle.description || 'No description'}</p>
                </div>
                <button onClick={() => toggleActive(bundle)} className={`badge ${bundle.isActive ? 'bg-accent/10 text-accent border-accent/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                  {bundle.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="space-y-2">
                {bundle.items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm bg-surface-high rounded-lg px-3 py-2">
                    <span className="text-white/70">{item.product?.name || 'Unknown'} × {item.quantity}</span>
                    <span className="font-mono text-white/40">LKR {Number(item.product?.sellingPrice || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <p className="font-display font-bold text-brand text-lg">LKR {Number(bundle.bundlePrice).toLocaleString()}</p>
                  {save > 0 && <p className="text-accent text-xs font-mono">Save LKR {save.toLocaleString()}</p>}
                </div>
                <p className="text-white/30 text-xs font-mono">Original: LKR {original.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Modal title="Create Bundle" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Bundle Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input h-24 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Bundle Price (LKR)</label>
              <input type="number" className="input" value={form.bundlePrice} onChange={e => setForm(f => ({ ...f, bundlePrice: e.target.value }))} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label">Products</label>
                <button type="button" onClick={addItemRow} className="btn-ghost py-1.5 px-3 text-xs">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Item
                </button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="label">Product</label>
                    <select className="input" value={item.productId} onChange={e => updateItemRow(idx, { productId: e.target.value })}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Qty</label>
                    <input type="number" min="1" className="input" value={item.quantity} onChange={e => updateItemRow(idx, { quantity: e.target.value })} />
                  </div>
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(idx)} className="btn-ghost py-2 px-3 text-red-400 hover:text-red-300 md:col-span-3 justify-center">
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Remove Item
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-white/40">Original Total</span>
                <span className="font-mono text-white">LKR {originalTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/40">Savings</span>
                <span className={`font-mono ${savings > 0 ? 'text-accent' : 'text-white/40'}`}>LKR {Math.max(savings, 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={saveBundle} disabled={saving} className="btn-primary flex-1 justify-center">
                <span className="material-symbols-outlined text-sm">save</span>
                Save Bundle
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
