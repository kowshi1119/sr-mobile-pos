import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import jsQR from 'jsqr'
import { useScanner } from '../context/ScannerContext'

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
  const [scanStatus, setScanStatus] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [imeiSelecting, setImeiSelecting] = useState(null)
  const [availableImeis, setAvailableImeis] = useState([])
  const [creditSale, setCreditSale] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [discount, setDiscount] = useState({ type: 'PERCENT', amount: 0 })

  const { pendingProduct, clearPendingProduct } = useScanner()

  const searchRef = useRef()
  const videoRef = useRef()
  const canvasRef = useRef()
  const barcodeBuffer = useRef({ chars:'', lastTime:0, timer: null })
  const scanQueue = useRef([])
  const isProcessing = useRef(false)

  // Load categories once
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)) }, [])

  // Handle product scanned from global scanner
  useEffect(() => {
    if (pendingProduct) {
      addToCart(pendingProduct)
      clearPendingProduct()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProduct])

  // Load products
  useEffect(() => {
    api.get('/products', { params: { search: search || undefined, category: catFilter || undefined } })
      .then(r => setProducts(r.data))
  }, [search, catFilter])

  const isLikelyImei = useCallback((value) => /^\d{14,17}$/.test(String(value || '').replace(/\D/g, '')), [])

  const playScanTone = useCallback((type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = type === 'success' ? 1800 : 400
      osc.type = 'square'
      gain.gain.setValueAtTime(type === 'success' ? 0.1 : 0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'success' ? 0.1 : 0.3))
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + (type === 'success' ? 0.1 : 0.3))
    } catch (e) {}
  }, [])

  const addToCart = useCallback(async (product, variantId = null) => {
    const resolvedVariantId = variantId || product.matchedVariant?.id || null
    const key = `${product.id}-${resolvedVariantId || 'base'}`
    const price = resolvedVariantId
      ? product.variants?.find(v => v.id === resolvedVariantId)?.priceOverride || product.sellingPrice
      : product.sellingPrice

    if (product.hasImei) {
      const matchedImei = product.matchedImei || null

      if (matchedImei) {
        if (matchedImei.status !== 'IN_STOCK') {
          return { added: false, reason: 'imei_sold', imei: matchedImei.imei }
        }

        let added = false
        setCart(c => {
          if (c.some(item => item.imeiId === matchedImei.id)) return c
          added = true
          return [...c, { key: `${product.id}-imei-${matchedImei.id}`, product, variantId: resolvedVariantId, imeiId: matchedImei.id, imeiNumber: matchedImei.imei, quantity: 1, unitPrice: Number(price) }]
        })

        return added
          ? { added: true, reason: 'imei_added', imei: matchedImei.imei }
          : { added: false, reason: 'already_in_cart', imei: matchedImei.imei }
      }

      const { data } = await api.get(`/products/${product.id}/imei`)
      const inStock = data.filter(i => i.status === 'IN_STOCK')
      if (inStock.length === 0) {
        alert('No IMEI in stock for this product!')
        return { added: false, reason: 'no_imei_stock' }
      }
      setAvailableImeis(inStock)
      setImeiSelecting({ product, variantId: resolvedVariantId, price })
      return { added: false, reason: 'select_imei' }
    }

    let updated = false
    let blockedByStock = false
    setCart(c => {
      const existing = c.find(i => i.key === key)
      if (existing) {
        if (existing.quantity >= existing.product.stockQuantity) {
          blockedByStock = true
          return c
        }
        updated = true
        return c.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
      }
      updated = true
      return [...c, { key, product, variantId: resolvedVariantId, imeiId: null, imeiNumber: null, quantity: 1, unitPrice: Number(price) }]
    })

    return updated
      ? { added: true, reason: 'product_added' }
      : { added: false, reason: blockedByStock ? 'max_stock' : 'unknown' }
  }, [setCart, setAvailableImeis, setImeiSelecting])

  const processNextScan = useCallback(async () => {
    if (isProcessing.current || scanQueue.current.length === 0) return
    isProcessing.current = true
    const barcode = scanQueue.current.shift()

    try {
      const { data } = await api.get('/products', { params: { barcode } })

      if (data.length > 0) {
        const product = data[0]
        const result = await addToCart(product)

        if (result?.added) {
          setScanStatus({
            type: 'success',
            name: product.name,
            sku: result.imei ? `IMEI ${result.imei}` : product.sku
          })
          setScanFlash(true)
          setTimeout(() => setScanFlash(false), 300)
          playScanTone('success')
        } else if (result?.reason === 'imei_sold') {
          setScanStatus({ type: 'error', name: 'IMEI already sold', sku: result.imei })
          playScanTone('error')
        } else if (result?.reason === 'already_in_cart') {
          setScanStatus({ type: 'error', name: 'IMEI already in cart', sku: result.imei })
          playScanTone('error')
        } else if (result?.reason === 'select_imei') {
          setScanStatus({ type: 'success', name: `Select IMEI for ${product.name}`, sku: product.sku })
          setScanFlash(true)
          setTimeout(() => setScanFlash(false), 300)
          playScanTone('success')
        } else if (result?.reason === 'max_stock') {
          setScanStatus({ type: 'error', name: 'Max stock reached', sku: product.name })
          playScanTone('error')
        }
      } else {
        setScanStatus({ type: 'error', name: isLikelyImei(barcode) ? 'IMEI not registered' : 'Product not found', sku: barcode })
        playScanTone('error')
      }

      setTimeout(() => setScanStatus(null), 2500)
    } catch(err) {
      console.error('Scan error:', err)
      setScanStatus({ type: 'error', name: 'Scan failed', sku: err.response?.data?.error || barcode })
      playScanTone('error')
      setTimeout(() => setScanStatus(null), 2500)
    } finally {
      isProcessing.current = false
      if (scanQueue.current.length > 0) processNextScan()
    }
  }, [addToCart, isLikelyImei, playScanTone])

  // Barcode reader detection
  const handleBarcodeKeydown = useCallback((e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const now = Date.now()
    const buf = barcodeBuffer.current
    if (now - buf.lastTime > 80 && buf.chars.length > 0) buf.chars = ''
    buf.lastTime = now
    if (buf.timer) clearTimeout(buf.timer)

    if (e.key === 'Enter') {
      if (buf.chars.length >= 3) {
        const barcode = buf.chars.trim()
        buf.chars = ''
        scanQueue.current.push(barcode)
        processNextScan()
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      buf.chars += e.key
      if (buf.chars.length >= 20) {
        buf.timer = setTimeout(() => {
          if (buf.chars.length >= 3) {
            const barcode = buf.chars.trim()
            buf.chars = ''
            scanQueue.current.push(barcode)
            processNextScan()
          }
        }, 100)
      }
    }
  }, [processNextScan])

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
          scanQueue.current.push(code.data)
          processNextScan()
        } else { animId = requestAnimationFrame(scan) }
      }
      animId = requestAnimationFrame(scan)
    })
    return () => {
      cancelAnimationFrame(animId)
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
  }, [cameraOpen, processNextScan])

  const selectImei = (imei) => {
    const { product, variantId, price } = imeiSelecting
    const key = `${product.id}-imei-${imei.id}`
    let added = false

    setCart(c => {
      if (c.some(item => item.imeiId === imei.id)) return c
      added = true
      return [...c, { key, product, variantId, imeiId: imei.id, imeiNumber: imei.imei, quantity: 1, unitPrice: Number(price) }]
    })

    if (!added) {
      alert(`IMEI ${imei.imei} is already in the cart`)
      return
    }

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

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountValue = discount.amount > 0
    ? discount.type === 'PERCENT'
      ? Math.round(subtotal * discount.amount / 100)
      : Math.min(discount.amount, subtotal)
    : 0
  const total = subtotal - discountValue

  // Keep creditAmount in sync with total when credit sale is on
  useEffect(() => {
    if (creditSale) setCreditAmount(String(total))
  }, [total, creditSale])

  const completeSale = async () => {
    if (cart.length === 0) { alert('Cart is empty'); return }
    setSubmitting(true)
    try {
      const { data } = await api.post('/sales', {
        customer,
        paymentMethod,
        creditAmount: creditSale ? parseFloat(creditAmount) || 0 : 0,
        discountAmount: discountValue,
        discountType: discount.type === 'PERCENT' ? `${discount.amount}%` : 'FIXED',
        items: cart.map(i => ({
          productId: i.product.id,
          variantId: i.variantId || null,
          imeiId: i.imeiId || null,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        }))
      })
      setDiscount({ type: 'PERCENT', amount: 0 })
      setShowDiscount(false)
      navigate('/sale-success', { state: { sale: data.sale, invoiceNumber: data.invoiceNumber, qrDataUrl: data.qrDataUrl } })
    } catch (e) { alert(e.response?.data?.error || 'Sale failed'); setSubmitting(false) }
  }

  useEffect(() => {
    const handleShortcuts = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F4') { e.preventDefault(); setCameraOpen(true) }
      if (e.key === 'F12') { e.preventDefault(); if (cart.length > 0) completeSale() }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur() }
    }
    window.addEventListener('keydown', handleShortcuts)
    return () => window.removeEventListener('keydown', handleShortcuts)
  }, [cart, completeSale])

  return (
    <div className={`flex gap-5 h-full -m-6 transition-colors duration-300 ${scanFlash ? 'bg-brand/10' : ''}`}>
      {/* Left — Product Browser */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 border-r border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-bold text-xl text-white">New Sale</h1>
          <div className="flex items-center gap-2">
            {scanQueue.current.length > 0 && (
              <span className="badge bg-brand/10 text-brand border-brand/20 text-xs font-mono">
                {scanQueue.current.length} queued
              </span>
            )}
            <button onClick={() => setCameraOpen(true)} className="btn-ghost py-2 px-3">
              <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
            </button>
          </div>
        </div>

        {/* Scan Status Bar */}
        {scanStatus ? (
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border animate-fade-in text-sm font-body transition-all mb-3 ${scanStatus.type === 'success' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <span className="material-symbols-outlined text-lg fill-icon flex-shrink-0">
              {scanStatus.type === 'success' ? 'barcode_scanner' : 'error'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{scanStatus.name}</p>
              <p className="text-xs opacity-60 font-mono">{scanStatus.sku}</p>
            </div>
            {scanStatus.type === 'success' && (
              <span className="material-symbols-outlined text-sm fill-icon flex-shrink-0">check_circle</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/3 border border-white/5 text-white/20 text-xs font-mono mb-3">
            <span className="material-symbols-outlined text-sm">barcode_scanner</span>
            Ready to scan — barcode or IMEI
          </div>
        )}

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
        <div className="flex gap-4 text-xs font-mono text-white/20 pt-2 border-t border-white/5 mt-2">
          <span>F2 Search</span>
          <span>F4 Camera</span>
          <span>F12 Complete Sale</span>
          <span>ESC Clear</span>
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-80 lg:w-96 flex flex-col p-6 bg-surface border-l border-white/5 overflow-y-auto">
        <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-brand fill-icon">shopping_cart</span>
          Cart <span className="badge bg-brand/10 text-brand border-brand/20">{cart.length}</span>
        </h2>

        {/* Cart items */}
        <div className="space-y-2 mb-4">
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
              {!item.product.hasImei && item.quantity >= item.product.stockQuantity && (
                <p className="text-red-400 text-xs font-mono mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  Max stock reached ({item.product.stockQuantity})
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-white/5 pt-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/40 text-sm font-body">Subtotal</span>
            <span className="font-mono text-white/70 text-sm">LKR {subtotal.toLocaleString()}</span>
          </div>
          {discountValue > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-accent/70 text-sm font-body">Discount</span>
              <span className="font-mono text-accent text-sm">- LKR {discountValue.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
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

        {/* Discount — collapsed by default */}
        <div className="mb-4">
          {!showDiscount ? (
            // Collapsed state — just a small link button
            <button
              type="button"
              onClick={() => setShowDiscount(true)}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-brand transition-colors py-1 font-mono">
              <span className="material-symbols-outlined text-sm">
                sell
              </span>
              Add discount (optional)
            </button>
          ) : (
            // Expanded state — full discount UI
            <div className="border border-brand/20 rounded-xl p-4 bg-brand/5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-white/60 text-sm font-body flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-brand">
                    sell
                  </span>
                  Customer Discount
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscount(false)
                    setDiscount({ type: 'PERCENT', amount: 0 })
                  }}
                  className="text-white/30 hover:text-red-400 transition-colors text-xs font-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                  Remove
                </button>
              </div>

              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscount(d => ({ ...d, type: 'PERCENT' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all ${
                    discount.type === 'PERCENT'
                      ? 'bg-brand/10 border-brand text-brand'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}>
                  % Percent
                </button>
                <button
                  type="button"
                  onClick={() => setDiscount(d => ({ ...d, type: 'FIXED' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all ${
                    discount.type === 'FIXED'
                      ? 'bg-brand/10 border-brand text-brand'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}>
                  LKR Fixed
                </button>
              </div>

              {/* Amount Input */}
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm font-mono flex-shrink-0 w-8">
                  {discount.type === 'PERCENT' ? '%' : 'LKR'}
                </span>
                <input
                  type="number"
                  min="0"
                  max={discount.type === 'PERCENT' ? 100 : subtotal}
                  className="input text-sm py-2 flex-1"
                  placeholder={discount.type === 'PERCENT' ? 'e.g. 10' : 'e.g. 500'}
                  value={discount.amount || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0
                    const max = discount.type === 'PERCENT' ? 100 : subtotal
                    setDiscount(d => ({ ...d, amount: Math.min(val, max) }))
                  }}
                />
              </div>

              {/* Live preview */}
              {discount.amount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-brand/10 rounded-lg">
                  <span className="text-brand/70 text-xs font-mono">
                    You save:
                  </span>
                  <span className="text-brand font-mono font-bold text-sm">
                    - LKR {discountValue.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="space-y-2 mb-4">
          <label className="label">Customer Info <span className="text-white/20 font-normal">(optional)</span></label>
          <input className="input text-sm py-2" placeholder="Customer name" value={customer.name} onChange={e => setCustomer(c => ({...c, name: e.target.value}))}/>
          <input className="input text-sm py-2" placeholder="Phone number" value={customer.phone} onChange={e => setCustomer(c => ({...c, phone: e.target.value}))}/>
          <input className="input text-sm py-2" placeholder="WhatsApp number (if different)" value={customer.whatsappNumber} onChange={e => setCustomer(c => ({...c, whatsappNumber: e.target.value}))}/>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-brand" checked={customer.whatsappOptIn} onChange={e => setCustomer(c => ({...c, whatsappOptIn: e.target.checked}))}/>
            <span className="text-white/50 text-xs">Send WhatsApp invoice & updates</span>
          </label>
        </div>

        {/* Credit Sale Toggle */}
        <div className="mb-4 p-3 rounded-xl border border-white/10 bg-surface-high space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-red-400" checked={creditSale} onChange={e => { setCreditSale(e.target.checked); if (!e.target.checked) setCreditAmount('') }}/>
            <span className="text-white/70 text-sm font-mono">Credit sale (customer owes)</span>
          </label>
          {creditSale && (
            <div>
              <label className="label text-xs">Credit Amount (LKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input text-sm py-2 border-red-500/30 focus:border-red-500"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
              />
            </div>
          )}
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
