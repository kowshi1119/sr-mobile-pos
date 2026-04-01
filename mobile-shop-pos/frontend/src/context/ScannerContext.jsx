import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import api from '../api/client'

const ScannerContext = createContext(null)

export function ScannerProvider({ children }) {
  const navigate = useNavigate()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState(null)
  const videoRef = useRef()
  const canvasRef = useRef()

  const openScanner = useCallback(() => setCameraOpen(true), [])
  const clearPendingProduct = useCallback(() => setPendingProduct(null), [])

  // Handle scan result
  const handleScanResult = useCallback(async (code) => {
    setCameraOpen(false)
    try {
      let product = null

      if (code.startsWith('SR-MOBILE|PROD|')) {
        // SR-MOBILE|PROD|{id}|{sku}|{barcode}|{name}|{price}
        const parts = code.split('|')
        const productId = parts[2]
        const { data } = await api.get(`/products/${productId}`)
        product = data
      } else {
        // Plain barcode
        const { data } = await api.get('/products', { params: { barcode: code } })
        if (data.length > 0) product = data[0]
      }

      if (product) {
        setPendingProduct(product)
        navigate('/billing')
      }
    } catch (err) {
      console.error('QR scan error:', err)
    }
  }, [navigate])

  // Camera scan loop
  useEffect(() => {
    if (!cameraOpen) return
    let animId
    let stream

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      stream = s
      videoRef.current.srcObject = stream
      videoRef.current.play()

      const scan = () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          animId = requestAnimationFrame(scan)
          return
        }
        const canvas = canvasRef.current
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(img.data, img.width, img.height)
        if (result?.data) {
          stream.getTracks().forEach(t => t.stop())
          handleScanResult(result.data)
        } else {
          animId = requestAnimationFrame(scan)
        }
      }
      animId = requestAnimationFrame(scan)
    }).catch(err => {
      console.error('Camera error:', err)
      setCameraOpen(false)
    })

    return () => {
      cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [cameraOpen, handleScanResult])

  return (
    <ScannerContext.Provider value={{ openScanner, pendingProduct, clearPendingProduct }}>
      {children}

      {/* Global camera modal */}
      {cameraOpen && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center"
          onClick={() => setCameraOpen(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video ref={videoRef} className="w-80 h-80 object-cover rounded-2xl" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-2 border-brand/60 rounded-2xl pointer-events-none" />
            <p className="text-white/60 text-sm text-center mt-3 font-mono">Point at QR code</p>
            <button
              onClick={() => setCameraOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </ScannerContext.Provider>
  )
}

export function useScanner() {
  const ctx = useContext(ScannerContext)
  if (!ctx) throw new Error('useScanner must be used within ScannerProvider')
  return ctx
}
