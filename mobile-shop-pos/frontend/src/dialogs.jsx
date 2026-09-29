import { useEffect, useRef, useState } from 'react'

// In-app replacements for window.alert / confirm / prompt.
// Native dialogs must not be used: in Electron on Windows, after a native alert()/confirm() closes,
// the page keeps a caret but stops receiving typed characters until the window is refocused
// (electron/electron#31917, fixed upstream by #54380 but not in any released Electron 44.x yet).
// These dialogs stay inside the page, so focus and typing keep working. Each call returns a Promise.

let listener = null
const queue = []
function open(dialog) {
  return new Promise(resolve => {
    queue.push({ ...dialog, resolve })
    listener?.()
  })
}

export const showAlert = (message, options = {}) => open({ kind: 'alert', message: String(message ?? ''), ...options })
export const askConfirm = (message, options = {}) => open({ kind: 'confirm', message: String(message ?? ''), ...options })
export const askText = (message, options = {}) => open({ kind: 'text', message: String(message ?? ''), ...options })

export function DialogHost() {
  const [current, setCurrent] = useState(null)
  const [text, setText] = useState('')
  const returnFocus = useRef(null)
  const primary = useRef(null)
  const input = useRef(null)
  const box = useRef(null)
  const showing = useRef(null)

  useEffect(() => {
    const next = () => {
      if (showing.current || !queue.length) return
      showing.current = queue.shift()
      returnFocus.current = document.activeElement
      setText('')
      setCurrent(showing.current)
    }
    listener = next
    next()
    return () => { if (listener === next) listener = null }
  }, [])

  useEffect(() => {
    if (!current) return
    const id = setTimeout(() => (input.current || primary.current)?.focus(), 0)
    return () => clearTimeout(id)
  }, [current])

  if (!current) return null

  const finish = value => {
    const done = current
    showing.current = null
    setCurrent(null)
    done.resolve(value)
    // Give focus back to the field the user was working in, then show any queued dialog.
    setTimeout(() => {
      const el = returnFocus.current
      if (el && el.isConnected && typeof el.focus === 'function') el.focus()
      listener?.()
    }, 0)
  }
  const cancelValue = current.kind === 'confirm' ? false : current.kind === 'text' ? null : undefined
  const accept = () => {
    if (current.kind === 'text') {
      if (current.expect && text.trim() !== current.expect) return
      finish(text)
    } else finish(current.kind === 'confirm' ? true : undefined)
  }
  const onKeyDown = e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue) }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); accept() }
    else if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog.
      const items = [...box.current.querySelectorAll('button,input')].filter(el => !el.disabled)
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const title = current.title || (current.kind === 'alert' ? 'SR Mobile POS' : 'Please confirm')
  const confirmLabel = current.confirmLabel || (current.kind === 'alert' ? 'OK' : current.kind === 'text' ? 'Continue' : 'Yes')
  const blocked = current.kind === 'text' && current.expect && text.trim() !== current.expect

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div ref={box} role={current.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" data-app-dialog={current.kind}
        className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-6 space-y-4 shadow-2xl animate-slide-up">
        <h2 id="app-dialog-title" className="font-display font-bold text-white text-lg">{title}</h2>
        <p id="app-dialog-message" className="text-white/80 text-sm whitespace-pre-line">{current.message}</p>
        {current.kind === 'text' && (
          <input ref={input} className="input" value={text} placeholder={current.placeholder || current.expect || ''} autoComplete="off"
            aria-label={current.message} onChange={e => setText(e.target.value)} />
        )}
        <div className="flex justify-end gap-3 pt-1">
          {current.kind !== 'alert' && (
            <button type="button" className="btn-ghost" onClick={() => finish(cancelValue)}>{current.cancelLabel || 'Cancel'}</button>
          )}
          <button type="button" ref={primary} disabled={blocked} onClick={accept}
            className={`btn-primary disabled:opacity-40 ${current.danger ? 'bg-red-600 hover:bg-red-700 text-paper' : ''}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
