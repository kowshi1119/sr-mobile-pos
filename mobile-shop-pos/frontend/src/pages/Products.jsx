import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function QrModal({ product, onClose }) {
  const [qr, setQr] = useState(null)
  useEffect(() => {
    api.get(`/products/${product.id}/qr`).then(r => setQr(r.data))
  }, [product.id])

  const download = (dataUrl, label) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${product.name.replace(/\s+/g, '-')}-${label}.png`
    a.click()
  }

  return (
    <Modal title={`QR Code — ${product.name}`} onClose={onClose}>
      {qr ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Smart QR */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-white/50 text-xs font-mono uppercase tracking-wider">Smart QR (SR-Mobile)</p>
              <img src={qr.qrDataUrl} alt="Smart QR" className="w-40 h-40 rounded-xl"/>
              <p className="text-white/30 text-xs font-mono text-center">Scan from any page</p>
              <button onClick={() => download(qr.qrDataUrl, 'smart-qr')} className="btn-ghost py-2 px-3 text-sm">
                <span className="material-symbols-outlined text-sm">download</span>Download
              </button>
            </div>
            {/* Barcode QR */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-white/50 text-xs font-mono uppercase tracking-wider">Barcode QR (Standard)</p>
              <img src={qr.barcodeQrDataUrl} alt="Barcode QR" className="w-40 h-40 rounded-xl"/>
              <p className="text-white/30 text-xs font-mono text-center">{qr.barcode}</p>
              <button onClick={() => download(qr.barcodeQrDataUrl, 'barcode-qr')} className="btn-ghost py-2 px-3 text-sm">
                <span className="material-symbols-outlined text-sm">download</span>Download
              </button>
            </div>
          </div>
          <p className="text-white/20 text-xs text-center font-mono">SKU: {qr.sku}</p>
        </div>
      ) : (
        <div className="flex justify-center py-8">
          <span className="material-symbols-outlined animate-spin text-brand text-3xl">refresh</span>
        </div>
      )}
    </Modal>
  )
}

function formatImeiSummary(summary) {
  if (!summary) return ''

  const createdCount = Array.isArray(summary.created) ? summary.created.length : (summary.createdCount || 0)
  const existingCount = summary.skippedExisting?.length || 0
  const duplicateCount = summary.skippedDuplicateInput?.length || 0
  const invalidCount = summary.invalidEntries?.length || 0
  const parts = []

  if (createdCount) parts.push(`${createdCount} added`)
  if (existingCount) parts.push(`${existingCount} already existed`)
  if (duplicateCount) parts.push(`${duplicateCount} duplicate line(s) skipped`)
  if (invalidCount) parts.push(`${invalidCount} invalid line(s) ignored`)

  return parts.length > 0 ? parts.join(', ') : 'No new IMEIs were added'
}

function ImeiModal({ product, onClose, canAdd }) {
  const [imeis, setImeis] = useState([])
  const [newImeis, setNewImeis] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { api.get(`/products/${product.id}/imei`).then(r => setImeis(r.data)) }, [product.id])
  const addImeis = async () => {
    setSaving(true)
    try {
      const nums = newImeis.split('\n').map(v => v.trim()).filter(Boolean)
      const { data } = await api.post(`/products/${product.id}/imei`, { imeiNumbers: nums })
      const r = await api.get(`/products/${product.id}/imei`)
      setImeis(r.data)
      setNewImeis('')
      alert(`IMEI update complete: ${formatImeiSummary(data)}`)
    } catch (e) {
      alert(e.response?.data?.error || 'Error adding IMEIs')
    } finally { setSaving(false) }
  }
  const inStock = imeis.filter(i => i.status === 'IN_STOCK')
  const sold = imeis.filter(i => i.status === 'SOLD')
  return (
    <Modal title={`IMEI Records — ${product.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="stat-card flex-1"><p className="text-xl font-display font-bold text-accent">{inStock.length}</p><p className="label">In Stock</p></div>
          <div className="stat-card flex-1"><p className="text-xl font-display font-bold text-white/40">{sold.length}</p><p className="label">Sold</p></div>
        </div>
        <div className="max-h-48 overflow-y-auto divide-y divide-white/5 card">
          {imeis.map(im => (
            <div key={im.id} className="flex items-center justify-between px-4 py-2">
              <span className="font-mono text-xs text-white/70">{im.imei}</span>
              <span className={`badge ${im.status === 'IN_STOCK' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-white/5 text-white/30 border-white/10'}`}>{im.status}</span>
            </div>
          ))}
        </div>
        {canAdd && <div>
          <label className="label">Add IMEI Numbers (one per line)</label>
          <textarea className="input h-24 resize-none font-mono text-xs" placeholder={"350000000000001\n350000000000002"} value={newImeis} onChange={e => setNewImeis(e.target.value)} />
          <button onClick={addImeis} disabled={saving || !newImeis.trim()} className="btn-primary mt-2">
            {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">add</span>}Add IMEIs
          </button>
        </div>}
      </div>
    </Modal>
  )
}

export default function Products() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [catFilter, setCatFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [qrProduct, setQrProduct] = useState(null)
  const [imeiProduct, setImeiProduct] = useState(null)
  const [labelProduct, setLabelProduct] = useState(null)
  const [labelQty, setLabelQty] = useState(1)
  const [labelQrData, setLabelQrData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const imgRef = useRef()
  const { can } = useAuth()
  const canCreate = can('products.create')
  const canEditAny = can('products.edit', 'products.editPrice', 'products.editStock')
  const canDelete = can('products.delete')
  const canSeeCost = can('products.viewCost')
  const canManageCategories = can('categories.manage')
  // New products may set every field; existing ones only the fields this user may change.
  const allow = key => !editProduct || can(key)

  const emptyForm = { categoryId:'', name:'', barcode:'', sellingPrice:'', costPrice:'', stockQuantity:'0', lowStockThreshold:'5', warrantyMonths:'', imageUrl:'', hasImei:false, imeiNumbers:'', variants:[] }
  const [form, setForm] = useState(emptyForm)

  const load = () => api.get('/products', { params: { search: search || undefined, category: catFilter || undefined } }).then(r => setProducts(r.data))
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const loadCategories = () => api.get('/categories').then(r => { setCategories(r.data); setCategoriesLoaded(true); return r.data })
  useEffect(() => { loadCategories() }, [])
  const activeCategories = categories.filter(c => c.isActive)
  useEffect(() => { load() }, [search, catFilter])

  const openAdd = () => { setEditProduct(null); setForm({ ...emptyForm, categoryId: activeCategories.length === 1 ? activeCategories[0].id : '' }); setFormError(''); setShowModal(true) }
  const openEdit = p => {
    setEditProduct(p)
    setForm({ categoryId: p.categoryId, name: p.name, barcode: p.barcode || '', sellingPrice: p.sellingPrice, costPrice: p.costPrice, stockQuantity: p.stockQuantity, lowStockThreshold: p.lowStockThreshold, warrantyMonths: p.warrantyMonths || '', imageUrl: p.imageUrl || '', hasImei: p.hasImei, imeiNumbers: '', variants: p.variants || [] })
    setFormError('')
    setShowModal(true)
  }

  const openLabelModal = async (product) => {
    setLabelProduct(product)
    setLabelQty(1)
    try {
      const { data } = await api.get(`/products/${product.id}/qr`)
      setLabelQrData(data)
    } catch (_) {
      setLabelQrData(null)
    }
  }

  const uploadImage = async file => {
    setImgUploading(true)
    const fd = new FormData(); fd.append('image', file)
    try { const r = await api.post('/products/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setForm(f => ({ ...f, imageUrl: r.data.imageUrl })) }
    catch (e) { setFormError(e.response?.data?.error || 'The image could not be uploaded. Use a PNG, JPEG or WebP image under 10 MB.') }
    finally { setImgUploading(false); if (imgRef.current) imgRef.current.value = '' }
  }

  const addCategory = async () => {
    const name = newCategory.trim()
    if (!name) return setFormError('Type a category name first.')
    try {
      const { data } = await api.post('/categories', { name })
      await loadCategories()
      setForm(f => ({ ...f, categoryId: data.id }))
      setNewCategory(''); setFormError('')
    } catch (e) { setFormError(e.response?.data?.error || 'The category could not be created.') }
  }

  const amountProblem = (value, label, required) => {
    const text = String(value ?? '').trim()
    if (!text) return required ? `Enter the ${label}.` : ''
    return /^\d+(\.\d{1,2})?$/.test(text) ? '' : `${label[0].toUpperCase() + label.slice(1)} must be a number like 1500 or 1499.50.`
  }

  const save = async () => {
    const problem = (!form.categoryId && (activeCategories.length ? 'Choose a category.' : 'Create a category first (below), then choose it.'))
      || (!String(form.name).trim() && 'Enter the product name.')
      || amountProblem(form.sellingPrice, 'selling price', true)
      || (canSeeCost && amountProblem(form.costPrice, 'cost price', false))
      || (String(form.stockQuantity ?? '').trim() !== '' && !/^\d+$/.test(String(form.stockQuantity).trim()) && 'Stock quantity must be a whole number.')
    if (problem) return setFormError(problem)
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        ...form,
        barcode: form.barcode?.trim() || '',
        imeiNumbers: form.imeiNumbers ? form.imeiNumbers.split('\n').map(v => v.trim()).filter(Boolean) : []
      }
      const response = editProduct
        ? await api.patch(`/products/${editProduct.id}`, payload)
        : await api.post('/products', payload)

      setShowModal(false)
      load()

      if (!editProduct && form.hasImei && response?.data?.imeiSummary) {
        alert(`Product saved. IMEI summary: ${formatImeiSummary(response.data.imeiSummary)}`)
      }
    } catch (e) { setFormError(e.response?.data?.error || 'The product could not be saved. Please try again.') } finally { setSaving(false) }
  }

  const deactivate = async id => {
    if (!confirm('Deactivate product?')) return
    try { await api.delete(`/products/${id}`); load() }
    catch (e) { alert(e.response?.data?.error || 'The product could not be deactivated.') }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="font-display font-bold text-2xl text-white">Products</h1>
          <p className="text-white/30 text-sm font-mono">{products.length} items</p></div>
        {canCreate && <button onClick={openAdd} className="btn-primary"><span className="material-symbols-outlined text-sm">add</span>Add Product</button>}
      </div>

      {canCreate && categoriesLoaded && activeCategories.length === 0 ? (
        <div className="card p-4 flex flex-wrap items-center gap-3 border-brand/30">
          <span className="material-symbols-outlined text-brand">info</span>
          <p className="text-white/80 text-sm flex-1">Products belong to a category. Create your first category (for example “Mobile Phones” or “Accessories”) — you can do it inside Add Product too.</p>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">search</span>
          <input className="input pl-10" placeholder="Search name, SKU or barcode…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-48" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map(p => {
          const lowStock = p.stockQuantity <= p.lowStockThreshold
          return (
            <div key={p.id} className="card overflow-hidden hover:border-brand/20 transition-colors group">
              {p.imageUrl ? (
                <div className="h-36 bg-surface-high overflow-hidden">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                </div>
              ) : (
                <div className="h-36 bg-surface-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/10 text-5xl">inventory_2</span>
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-body font-medium text-white text-sm leading-tight">{p.name}</p>
                  {lowStock && <span className="badge bg-red-500/10 text-red-400 border-red-500/20 flex-shrink-0">Low</span>}
                </div>
                <p className="font-mono text-brand text-xs">{p.sku}</p>
                <p className="font-mono text-white/35 text-[11px] break-all">Barcode: {p.barcode}</p>
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-white text-base">LKR {Number(p.sellingPrice).toLocaleString()}</p>
                  <p className="text-white/30 text-xs">Qty: {p.stockQuantity}</p>
                </div>
                <p className="text-white/20 text-xs">{p.category?.name}</p>
                {/* Actions */}
                <div className="flex gap-1 pt-1 flex-wrap">
                  {canEditAny && <button onClick={() => openEdit(p)} className="btn-ghost py-1.5 px-2 text-xs flex-1 justify-center" title="Edit"><span className="material-symbols-outlined text-sm">edit</span></button>}
                  <button onClick={() => setQrProduct(p)} className="btn-ghost py-1.5 px-2 text-xs flex-1 justify-center"><span className="material-symbols-outlined text-sm">qr_code_2</span></button>
                  <button onClick={() => openLabelModal(p)} className="btn-ghost py-1.5 px-2 text-xs flex-1 justify-center" title="Print Label"><span className="material-symbols-outlined text-sm">label</span></button>
                  {p.hasImei && <button onClick={() => setImeiProduct(p)} className="btn-ghost py-1.5 px-2 text-xs flex-1 justify-center" title="IMEI numbers"><span className="material-symbols-outlined text-sm">sim_card</span></button>}
                  {canDelete && <button onClick={() => deactivate(p.id)} className="btn-ghost py-1.5 px-2 text-xs text-red-400 hover:text-red-300" title="Deactivate"><span className="material-symbols-outlined text-sm">delete</span></button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editProduct ? 'Edit Product' : 'Add Product'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Category</label>
                <select className="input" value={form.categoryId} disabled={!allow('products.edit')} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))}>
                  <option value="">{activeCategories.length ? 'Select category…' : 'No categories yet'}</option>
                  {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!editProduct && (canManageCategories ? (
                  <div className="flex gap-2 mt-2">
                    <input className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder={activeCategories.length ? 'Or add a new category…' : 'Type a category name, e.g. Mobile Phones'} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}/>
                    <button type="button" onClick={addCategory} className="btn-ghost whitespace-nowrap"><span className="material-symbols-outlined text-sm">add</span>Add category</button>
                  </div>
                ) : !activeCategories.length && <p className="text-white/60 text-xs mt-1">Ask the owner to create a category first.</p>)}
              </div>
              <div className="col-span-2">
                <label className="label">Product Name</label>
                <input className="input" value={form.name} disabled={!allow('products.edit')} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. iPhone 15 Pro Max"/>
              </div>
              <div className="col-span-2">
                <label className="label">Custom Barcode (optional)</label>
                <input
                  className="input font-mono"
                  disabled={!allow('products.edit')}
                  value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  placeholder={editProduct ? 'Edit the barcode or clear it to auto-generate a new one' : 'Leave blank to auto-generate, or enter your own barcode'}
                />
                <p className="text-white/35 text-xs mt-1">
                  Any barcode format is accepted. Leave it empty to let the system create one automatically.
                </p>
              </div>
              <div>
                <label className="label">Selling Price (LKR) *</label>
                <input className="input" type="number" min="0" step="0.01" inputMode="decimal" disabled={!allow('products.editPrice')} value={form.sellingPrice} onChange={e => setForm(f => ({...f, sellingPrice: e.target.value}))}/>
              </div>
              {canSeeCost && <div>
                <label className="label">Cost Price (LKR, optional)</label>
                <input className="input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" disabled={!allow('products.editPrice')} value={form.costPrice} onChange={e => setForm(f => ({...f, costPrice: e.target.value}))}/>
              </div>}
              <div>
                <label className="label">Stock Qty</label>
                <input className="input" type="number" min="0" step="1" disabled={!allow('products.editStock') || (editProduct && form.hasImei)} value={form.stockQuantity} onChange={e => setForm(f => ({...f, stockQuantity: e.target.value}))}/>
              </div>
              <div>
                <label className="label">Low Stock Threshold</label>
                <input className="input" type="number" min="0" step="1" disabled={!allow('products.edit')} value={form.lowStockThreshold} onChange={e => setForm(f => ({...f, lowStockThreshold: e.target.value}))}/>
              </div>
              <div>
                <label className="label">Warranty (Months, optional)</label>
                <input className="input" type="number" min="0" step="1" disabled={!allow('products.edit')} placeholder="Inherits from category" value={form.warrantyMonths} onChange={e => setForm(f => ({...f, warrantyMonths: e.target.value}))}/>
              </div>
              <div>
                <label className="label">Product Image (optional)</label>
                <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => e.target.files[0] && uploadImage(e.target.files[0])}/>
                <button type="button" onClick={() => imgRef.current.click()} className="btn-ghost w-full justify-center py-2" disabled={imgUploading || !allow('products.edit')}>
                  {imgUploading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">cloud_upload</span>}
                  {imgUploading ? 'Uploading…' : form.imageUrl ? 'Change Image' : 'Upload Image'}
                </button>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-2 h-16 rounded-lg object-cover"/>}
              </div>
            </div>

            {/* IMEI toggle */}
            <div className="flex items-center gap-3 p-3 bg-surface-low rounded-lg border border-white/5">
              <input type="checkbox" id="hasImei" disabled={!!editProduct} checked={form.hasImei} onChange={e => setForm(f => ({...f, hasImei: e.target.checked}))} className="w-4 h-4 accent-brand"/>
              <label htmlFor="hasImei" className="text-white/70 text-sm cursor-pointer">This is a phone with IMEI numbers</label>
            </div>
            {form.hasImei && !editProduct && (
              <div>
                <label className="label">IMEI Numbers (one per line)</label>
                <textarea className="input h-24 resize-none font-mono text-xs" placeholder={"350000000000001\n350000000000002"} value={form.imeiNumbers} onChange={e => setForm(f => ({...f, imeiNumbers: e.target.value}))}/>
              </div>
            )}

            {formError && (
              <div role="alert" className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="material-symbols-outlined text-red-400 text-lg">error</span>
                <p className="text-red-400 text-sm">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={saving || imgUploading} className="btn-primary flex-1 justify-center">
                {saving ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : <span className="material-symbols-outlined text-sm">save</span>}
                {editProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {qrProduct && <QrModal product={qrProduct} onClose={() => setQrProduct(null)} />}
      {imeiProduct && <ImeiModal product={imeiProduct} canAdd={can('products.editStock')} onClose={() => { setImeiProduct(null); load() }} />}

      {labelProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setLabelProduct(null)}>
          <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <h2 className="font-display font-bold text-white text-lg">Print Barcode Labels</h2>
              <button onClick={() => setLabelProduct(null)} className="text-white/30 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex justify-center">
                <div id="label-preview" className="bg-paper text-black rounded-lg p-3 w-56 border-2 border-gray-200 text-center">
                  <p className="font-bold text-sm leading-tight mb-1">{labelProduct.name}</p>
                  {labelQrData?.qrDataUrl && (
                    <img src={labelQrData.qrDataUrl} alt="Barcode" className="w-24 h-24 mx-auto my-1" />
                  )}
                  <p className="text-xs font-mono text-gray-600">{labelProduct.barcode}</p>
                  <p className="text-xs text-gray-500">SKU: {labelProduct.sku}</p>
                  <p className="text-base font-bold mt-1">LKR {Number(labelProduct.sellingPrice).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">S R Mobile — Chunnakam</p>
                </div>
              </div>

              <div>
                <label className="label">How many labels to print?</label>
                <input type="number" min="1" max="100" className="input" value={labelQty} onChange={e => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>

              <button
                onClick={() => {
                  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
                  const frame = document.createElement('iframe')
                  frame.style.position='fixed'; frame.style.width='0'; frame.style.height='0'; frame.style.border='0'
                  document.body.appendChild(frame)
                  const win = frame.contentWindow
                  const labels = Array(labelQty).fill(null).map(() => `
                    <div style="display:inline-block;width:210px;border:1px solid #ccc;border-radius:8px;padding:10px;margin:4px;text-align:center;font-family:Arial,sans-serif;page-break-inside:avoid;">
                      <p style="font-weight:bold;font-size:12px;margin:0 0 4px;line-height:1.2">${escape(labelProduct.name)}</p>
                      ${labelQrData?.qrDataUrl ? `<img src="${labelQrData.qrDataUrl}" style="width:80px;height:80px"/>` : ''}
                      <p style="font-family:monospace;font-size:10px;color:#666;margin:2px 0">${escape(labelProduct.barcode)}</p>
                      <p style="font-size:10px;color:#888;margin:0">SKU: ${escape(labelProduct.sku)}</p>
                      <p style="font-weight:bold;font-size:14px;margin:4px 0 2px">LKR ${Number(labelProduct.sellingPrice).toLocaleString()}</p>
                      <p style="font-size:9px;color:#999">S R Mobile — Chunnakam</p>
                    </div>
                  `).join('')

                  win.document.write(`
                    <html><head>
                    <title>Labels - ${escape(labelProduct.name)}</title>
                    <style>
                      body { margin:10px; }
                      @media print {
                        body { margin:0; }
                        @page { margin:5mm; }
                      }
                    </style>
                    </head><body>
                    <div style="display:flex;flex-wrap:wrap">${labels}</div>

                    </body></html>
                  `)
                  win.document.close()
                  win.onafterprint = () => frame.remove()
                  Promise.all(Array.from(win.document.images).map(img => img.decode().catch(() => {}))).then(() => {win.focus();win.print()})
                }}
                className="btn-primary w-full justify-center">
                <span className="material-symbols-outlined text-sm fill-icon">print</span>
                Print {labelQty} Label{labelQty > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
