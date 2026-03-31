import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import jsQR from 'jsqr'

export default function Billing() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ name:'', phone:'', whatsappNumber:'', whatsappOptIn:false })
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [scanFlash, setScanFlash] = useState(false)
  const [lastScanned, setLastScanned] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [imeiSelecting, setImeiSelecting] = useState(null)
  const [availableImeis, setAvailableImeis] = useState([])

  const searchRef = useRef()
  const videoRef = useRef()
  const canvasRef = useRef()
  const barcodeBuffer = useRef({ chars:'', lastTime:0 })

  // Load categories once
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)) }, [])

  // Load products
  useEffect(() => {
    api.get('/products', { params: { search: search || undefined, category: catFilter || undefined } })
      .then(r => setProducts(r.data))
  }, [search, catFilter])

  // Barcode reader detection
  const handleBarcodeKeydown = useCallback(async (e) => {
    if (document.activeElement === searchRef.current) return
    const now = Date.now()
    const buf = barcodeBuffer.current
    if (now - buf.lastTime > 100) { buf.chars = '' }
    buf.lastTime = now

    if (e.key === 'Enter' && buf.chars.length > 3) {
      const barcode = buf.chars
      buf.chars = ''
      try {
        const { data } = await api.get('/products', { params: { barcode } })
        if (data.length > 0) {
          addToCart(data[0])
          setScanFlash(true)
          setLastScanned(data[0])
          setTimeout(() => setScanFlash(false), 400)
        }
      } catch {}
    } else if (e.key.length === 1) {
      buf.chars += e.key
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleBarcodeKeydown)
    return () => window.removeEventListener('keydown', handleBarcodeKeydown)
  }, [handleBarcodeKeydown])

  // Camera QR scanner
  useEffect(() => {
    if (!cameraOpen) return
    let animId
    navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } }).then(stream => {
      videoRef.current.srcObject = stream
      videoRef.current.play()
      const scan = () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) { animId = requestAnimationFrame(scan); return }
        const canvas = canvasRef.current
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(img.data, img.width, img.height)
        if (code?.data) {
          stream.getTracks().forEach(t => t.stop())
          setCameraOpen(false)
          api.get('/products', { params: { barcode: code.data } }).then(({ data }) => {
            if (data.length > 0) { addToCart(data[0]); setLastScanned(data[0]) }
          })
        } else { animId = requestAnimationFrame(scan) }
      }
      animId = requestAnimationFrame(scan)
    })
    return () => {
      cancelAnimationFrame(animId)
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
  }, [cameraOpen])

  const addToCart = async (product, variantId = null) => {
    const key = `${product.id}-${variantId || 'base'}`
    const price = variantId
      ? product.variants?.find(v => v.id === variantId)?.priceOverride || product.sellingPrice
      : product.sellingPrice

    if (product.hasImei) {
      // Fetch available IMEIs
      const { data } = await api.get(`/products/${product.id}/imei`)
      const inStock = data.filter(i => i.status === 'IN_STOCK')
      if (inStock.length === 0) { alert('No IMEI in stock for this product!'); return }
      setAvailableImeis(inStock)
      setImeiSelecting({ product, variantId, price })
      return
    }

    setCart(c => {
      const existing = c.find(i => i.key === key)
      if (existing) {
        if (existing.quantity >= existing.product.stockQuantity) return c
        return c.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...c, { key, product, variantId, imeiId: null, imeiNumber: null, quantity: 1, unitPrice: Number(price) }]
    })
  }

  const selectImei = (imei) => {
    const { product, variantId, price } = imeiSelecting
    const key = `${product.id}-imei-${imei.id}`
    setCart(c => [...c, { key, product, variantId, imeiId: imei.id, imeiNumber: imei.imei, quantity: 1, unitPrice: Number(price) }])
    setImeiSelecting(null)
    setAvailableImeis([])
  }

  const updateQty = (key, delta) => {
    setCart(c => c.map(i => i.key === key
      ? { ...i, quantity: Math.max(1, i.quantity + delta) }
      : i
    ).filter(i => i.quantity > 0))
  }
  const removeItem = key => setCart(c => c.filter(i => i.key !== key))

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const completeSale = async () => {
    if (!customer.name || !customer.phone) { alert('Customer name and phone required'); return }
    if (cart.length === 0) { alert('Cart is empty'); return }
    setSubmitting(true)
    try {
      const { data } = await api.post('/sales', {
        customer,
        paymentMethod,
        items: cart.map(i => ({
          productId: i.product.id,
          variantId: i.variantId || null,
          imeiId: i.imeiId || null,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        }))
      })
      navigate('/sale-success', { state: { sale: data.sale, invoiceNumber: data.invoiceNumber, qrDataUrl: data.qrDataUrl } })
    } catch (e) { alert(e.response?.data?.error || 'Sale failed'); setSubmitting(false) }
  }

  return (
    <div className={`flex gap-5 h-full -m-6 transition-colors duration-300 ${scanFlash ? 'bg-brand/10' : ''}`}>
      {/* Left — Product Browser */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 border-r border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-bold text-xl text-white">New Sale</h1>
          <div className="flex items-center gap-2">
            {lastScanned && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-lg animate-fade-in">
                <span className="material-symbols-outlined text-brand text-sm">barcode_scanner</span>
                <span className="text-brand text-xs font-mono">{lastScanned.name}</span>
              </div>
            )}
            <button onClick={() => setCameraOpen(true)} className="btn-ghost py-2 px-3">
              <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
            </button>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-lg">search</span>
            <input ref={searchRef} className="input pl-10 text-sm" placeholder="Search by name or SKU…" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && products.length > 0) addToCart(products[0]) }}/>
          </div>
          <select className="input w-40 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
          {products.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="card p-3 text-left hover:border-brand/30 hover:bg-brand/5 active:scale-95 transition-all group">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform"/>
              ) : (
                <div className="w-full h-24 bg-surface-high rounded-lg mb-2 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/10 text-3xl">inventory_2</span>
                </div>
              )}
              <p className="text-white text-xs font-body font-medium leading-tight mb-1 line-clamp-2">{p.name}</p>
              <p className="font-display font-bold text-brand text-sm">LKR {Number(p.sellingPrice).toLocaleString()}</p>
              <p className={`text-xs font-mono mt-0.5 ${p.stockQuantity <= p.lowStockThreshold ? 'text-red-400' : 'text-white/20'}`}>Qty: {p.stockQuantity}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-80 lg:w-96 flex flex-col p-6 bg-surface overflow-hidden">
        <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-brand fill-icon">shopping_cart</span>
          Cart <span className="badge bg-brand/10 text-brand border-brand/20">{cart.length}</span>
        </h2>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {cart.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <span className="material-symbols-outlined text-5xl block mb-2">shopping_cart</span>
              <p className="font-mono text-sm">Scan or search to add items</p>
            </div>
          )}
          {cart.map(item => (
            <div key={item.key} className="card p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-white text-xs font-body font-medium leading-tight flex-1">{item.product.name}</p>
                <button onClick={() => removeItem(item.key)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              {item.imeiNumber && <p className="text-white/30 text-xs font-mono">IMEI: {item.imeiNumber}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.key, -1)} className="w-6 h-6 rounded bg-surface-high text-white/50 hover:text-white flex items-center justify-center text-sm">−</button>
                  <span className="w-8 text-center text-white text-sm font-mono">{item.quantity}</span>
                  <button onClick={() => updateQty(item.key, 1)} className="w-6 h-6 rounded bg-surface-high text-white/50 hover:text-white flex items-center justify-center text-sm">+</button>
                </div>
                <p className="font-display font-bold text-white text-sm">LKR {(item.unitPrice * item.quantity).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-white/5 pt-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-white/50 text-sm uppercase tracking-wider">Total</span>
            <span className="font-display font-black text-brand text-2xl">LKR {total.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="mb-4">
          <label className="label">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['CASH','CARD','TRANSFER'].map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 rounded-lg text-xs font-mono border transition-all ${paymentMethod === m ? 'bg-brand/10 border-brand text-brand' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Customer */}
        <div className="space-y-2 mb-4">
          <label className="label">Customer Info</label>
          <input className="input text-sm py-2" placeholder="Customer name *" value={customer.name} onChange={e => setCustomer(c => ({...c, name: e.target.value}))}/>
          <input className="input text-sm py-2" placeholder="Phone number *" value={customer.phone} onChange={e => setCustomer(c => ({...c, phone: e.target.value}))}/>
          <input className="input text-sm py-2" placeholder="WhatsApp number (if different)" value={customer.whatsappNumber} onChange={e => setCustomer(c => ({...c, whatsappNumber: e.target.value}))}/>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-brand" checked={customer.whatsappOptIn} onChange={e => setCustomer(c => ({...c, whatsappOptIn: e.target.checked}))}/>
            <span className="text-white/50 text-xs">Send WhatsApp invoice & updates</span>
          </label>
        </div>

        <button onClick={completeSale} disabled={submitting || cart.length === 0} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-40">
          {submitting ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined fill-icon">check_circle</span>}
          {submitting ? 'Processing…' : 'Complete Sale'}
        </button>
      </div>

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center" onClick={() => setCameraOpen(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video ref={videoRef} className="w-80 h-80 object-cover rounded-2xl"/>
            <canvas ref={canvasRef} className="hidden"/>
            <div className="absolute inset-0 border-2 border-brand/60 rounded-2xl"/>
            <p className="text-white/60 text-sm text-center mt-3 font-mono">Point at QR code</p>
            <button onClick={() => setCameraOpen(false)} className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* IMEI selector */}
      {imeiSelecting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImeiSelecting(null)}>
          <div className="bg-surface rounded-2xl border border-white/10 w-80 p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-white mb-1">Select IMEI</h3>
            <p className="text-white/30 text-xs mb-4 font-mono">{imeiSelecting.product.name}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableImeis.map(im => (
                <button key={im.id} onClick={() => selectImei(im)} className="w-full text-left px-4 py-3 bg-surface-low rounded-lg border border-white/5 hover:border-brand/30 hover:bg-brand/5 transition-all">
                  <p className="font-mono text-sm text-white">{im.imei}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
