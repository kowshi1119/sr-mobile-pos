import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

function Modal({ title, onClose, children, maxWidth = 'max-w-3xl' }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-surface rounded-2xl border border-white/10 w-full ${maxWidth} max-h-[90vh] overflow-y-auto animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

const emptySupplier = { name: '', phone: '', email: '', address: '', notes: '' }
const emptyPurchaseForm = {
  invoiceRef: '',
  purchasedAt: new Date().toISOString().slice(0, 10),
  notes: '',
  items: [{ productId: '', productName: '', quantity: 1, unitCost: '', updateStock: false }]
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPurchase, setShowPurchase] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(emptySupplier)
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/suppliers', { params: { search: search || undefined } })
      .then(r => setSuppliers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])
  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data)).catch(() => {})
  }, [])

  const openAdd = () => {
    setSelected(null)
    setForm(emptySupplier)
    setShowModal(true)
  }

  const openEdit = supplier => {
    setSelected(supplier)
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    })
    setShowModal(true)
  }

  const openDetail = async supplier => {
    try {
      const { data } = await api.get(`/suppliers/${supplier.id}`)
      setDetail(data)
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to load supplier')
    }
  }

  const saveSupplier = async () => {
    if (!form.name.trim()) return alert('Supplier name is required')
    setSaving(true)
    try {
      if (selected) {
        await api.patch(`/suppliers/${selected.id}`, form)
      } else {
        await api.post('/suppliers', form)
      }
      setShowModal(false)
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const addPurchaseRow = () => {
    setPurchaseForm(f => ({
      ...f,
      items: [...f.items, { productId: '', productName: '', quantity: 1, unitCost: '', updateStock: false }]
    }))
  }

  const updatePurchaseRow = (idx, patch) => {
    setPurchaseForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, ...patch } : item)
    }))
  }

  const removePurchaseRow = idx => {
    setPurchaseForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }))
  }

  const purchaseTotal = useMemo(() => purchaseForm.items.reduce((s, item) => s + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)), 0), [purchaseForm])

  const savePurchase = async () => {
    if (!detail) return
    const cleanedItems = purchaseForm.items
      .filter(i => i.productName || i.productId)
      .map(i => ({
        ...i,
        quantity: Number(i.quantity) || 0,
        unitCost: Number(i.unitCost) || 0
      }))
    if (cleanedItems.length === 0) return alert('Add at least one purchase item')

    setSaving(true)
    try {
      await api.post(`/suppliers/${detail.id}/purchases`, {
        invoiceRef: purchaseForm.invoiceRef,
        purchasedAt: purchaseForm.purchasedAt,
        notes: purchaseForm.notes,
        items: cleanedItems
      })
      setShowPurchase(false)
      setPurchaseForm(emptyPurchaseForm)
      openDetail(detail)
      load()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to record purchase')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Suppliers</h1>
          <p className="text-white/30 text-sm font-mono">Manage suppliers and purchase history</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Supplier
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">search</span>
          <input className="input pl-10" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Name', 'Phone', 'Email', 'Total Purchases', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan="5" className="text-center py-10 text-white/30 font-mono">Loading...</td></tr>
              )}
              {!loading && suppliers.length === 0 && (
                <tr><td colSpan="5" className="text-center py-10 text-white/20 font-mono">No suppliers found</td></tr>
              )}
              {suppliers.map(s => (
                <tr key={s.id} onClick={() => openDetail(s)} className="hover:bg-white/3 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-white font-body font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-brand font-mono text-sm">{s._count?.purchases || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); openEdit(s) }} className="btn-ghost py-1.5 px-2 text-xs" title="Edit">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={e => { e.stopPropagation(); openDetail(s) }} className="btn-ghost py-1.5 px-2 text-xs" title="View">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={selected ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowModal(false)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input h-24 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={saveSupplier} disabled={saving} className="btn-primary flex-1 justify-center">
                <span className="material-symbols-outlined text-sm">save</span>
                {selected ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-white/30 text-xs font-mono mb-1">Phone</p>
                <p className="text-white">{detail.phone || '—'}</p>
              </div>
              <div className="card p-4">
                <p className="text-white/30 text-xs font-mono mb-1">Email</p>
                <p className="text-white">{detail.email || '—'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-white">Purchase History</h3>
                <p className="text-white/30 text-xs font-mono">{detail.purchases?.length || 0} recorded purchase(s)</p>
              </div>
              <button onClick={() => setShowPurchase(true)} className="btn-primary py-2 px-4 text-sm">
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Record Purchase
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {detail.purchases?.length === 0 && (
                <div className="card p-5 text-center text-white/20 font-mono text-sm">No purchases recorded yet</div>
              )}
              {detail.purchases?.map(p => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-body font-medium">{p.invoiceRef || 'No invoice reference'}</p>
                      <p className="text-white/30 text-xs font-mono">{new Date(p.purchasedAt).toLocaleDateString('en-LK')} · {p.items?.length || 0} items</p>
                    </div>
                    <p className="font-display font-bold text-brand">LKR {Number(p.totalAmount).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {showPurchase && detail && (
        <Modal title={`Record Purchase — ${detail.name}`} onClose={() => setShowPurchase(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Invoice Reference</label>
                <input className="input" value={purchaseForm.invoiceRef} onChange={e => setPurchaseForm(f => ({ ...f, invoiceRef: e.target.value }))} />
              </div>
              <div>
                <label className="label">Purchase Date</label>
                <input type="date" className="input" value={purchaseForm.purchasedAt} onChange={e => setPurchaseForm(f => ({ ...f, purchasedAt: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label">Items</label>
                <button onClick={addPurchaseRow} type="button" className="btn-ghost py-1.5 px-3 text-xs">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Item
                </button>
              </div>
              {purchaseForm.items.map((item, idx) => (
                <div key={idx} className="card p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Product Link (optional)</label>
                      <select
                        className="input"
                        value={item.productId}
                        onChange={e => {
                          const product = products.find(p => p.id === e.target.value)
                          updatePurchaseRow(idx, {
                            productId: e.target.value,
                            productName: product?.name || item.productName,
                            unitCost: product?.costPrice || item.unitCost
                          })
                        }}>
                        <option value="">Not linked</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Product Name</label>
                      <input className="input" value={item.productName} onChange={e => updatePurchaseRow(idx, { productName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Quantity</label>
                      <input type="number" min="0" step="0.01" className="input" value={item.quantity} onChange={e => updatePurchaseRow(idx, { quantity: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Unit Cost (LKR)</label>
                      <input type="number" min="0" step="0.01" className="input" value={item.unitCost} onChange={e => updatePurchaseRow(idx, { unitCost: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60">
                      <input type="checkbox" className="w-4 h-4 accent-brand" checked={!!item.updateStock} onChange={e => updatePurchaseRow(idx, { updateStock: e.target.checked })} />
                      Update stock?
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-brand font-mono text-sm">LKR {((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toLocaleString()}</span>
                      {purchaseForm.items.length > 1 && (
                        <button onClick={() => removePurchaseRow(idx)} className="text-red-400 hover:text-red-300" type="button">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input h-24 resize-none" value={purchaseForm.notes} onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="card p-4 flex items-center justify-between">
              <span className="text-white/40 font-mono text-sm">Grand Total</span>
              <span className="font-display font-black text-brand text-xl">LKR {purchaseTotal.toLocaleString()}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPurchase(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={savePurchase} disabled={saving} className="btn-primary flex-1 justify-center">
                <span className="material-symbols-outlined text-sm">save</span>
                Save Purchase
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
