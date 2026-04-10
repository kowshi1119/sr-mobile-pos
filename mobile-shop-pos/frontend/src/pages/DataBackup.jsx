import { useRef, useState } from 'react'
import api from '../api/client'
import { useTheme } from '../context/ThemeContext'

function ActionButton({ icon, label, onClick, variant = 'primary', disabled = false }) {
  const base = variant === 'danger'
    ? 'flex items-center gap-2 px-5 py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-display font-bold uppercase tracking-wide text-sm disabled:opacity-50'
    : variant === 'ghost'
      ? 'flex items-center gap-2 px-5 py-3 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-all font-display font-bold uppercase tracking-wide text-sm disabled:opacity-50'
      : 'flex items-center gap-2 px-5 py-3 rounded-lg bg-brand text-onbrand hover:bg-brand-dark transition-all font-display font-bold uppercase tracking-wide text-sm disabled:opacity-50'

  return (
    <button onClick={onClick} disabled={disabled} className={base}>
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  )
}

export default function DataBackup() {
  const fileRef = useRef(null)
  const { theme, setTheme } = useTheme()
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('Manage backups safely before major changes or deployments.')

  const handleExport = async () => {
    try {
      setBusy('export')
      const { data } = await api.get('/data/export')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sr-mobile-pos-backup-${stamp}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage(`Backup exported successfully at ${new Date().toLocaleString('en-LK')}.`)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Export failed. Please try again.')
    } finally {
      setBusy('')
    }
  }

  const handleImportPick = () => fileRef.current?.click()

  const handleImport = async event => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setBusy('import')
      const raw = await file.text()
      const payload = JSON.parse(raw)
      const { data } = await api.post('/data/import', payload)
      setMessage(`Import completed. ${data.importedCount || 0} record(s) were merged from ${file.name}.`)
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Import failed. Make sure the JSON file is valid.')
    } finally {
      event.target.value = ''
      setBusy('')
    }
  }

  const handleReset = async () => {
    const confirmText = window.prompt('Type RESET to clear business data')
    if (confirmText !== 'RESET') {
      setMessage('Reset cancelled.')
      return
    }

    try {
      setBusy('reset')
      const { data } = await api.post('/data/reset', { confirmText })
      setMessage(`Reset complete. ${data.deletedCount || 0} record(s) were cleared.`)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Reset failed. Please try again.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Data & Backup</h1>
        <p className="text-white/30 text-sm font-mono">Export, restore, and reset your shop data securely.</p>
      </div>

      <div className="card p-4 border-brand/20 bg-brand/5">
        <p className="text-sm text-white/80">{message}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl text-white">Export Data</h2>
            <div className="h-px bg-white/10 mt-4 mb-5" />
            <p className="text-white/50 text-sm leading-6">Download your products, customers, sales, repairs, and settings as a JSON backup file.</p>
          </div>
          <ActionButton
            icon="download"
            label={busy === 'export' ? 'Exporting...' : 'Export JSON Backup'}
            onClick={handleExport}
            disabled={busy !== ''}
          />
        </section>

        <section className="card p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl text-white">Import Data</h2>
            <div className="h-px bg-white/10 mt-4 mb-5" />
            <p className="text-white/50 text-sm leading-6">Restore data from a previous JSON backup. Imported records merge safely with existing data.</p>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          <ActionButton
            icon="upload"
            label={busy === 'import' ? 'Importing...' : 'Import JSON Backup'}
            onClick={handleImportPick}
            disabled={busy !== ''}
            variant="ghost"
          />
        </section>

        <section className="card p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl text-red-400">Danger Zone</h2>
            <div className="h-px bg-white/10 mt-4 mb-5" />
            <p className="text-white/50 text-sm leading-6">Clear business data from the current database. This cannot be undone, so export a backup first.</p>
          </div>
          <ActionButton
            icon="warning"
            label={busy === 'reset' ? 'Resetting...' : 'Reset All Data'}
            onClick={handleReset}
            disabled={busy !== ''}
            variant="danger"
          />
        </section>

        <section className="card p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl text-white">Appearance</h2>
            <div className="h-px bg-white/10 mt-4 mb-5" />
            <p className="text-white/50 text-sm leading-6">Switch between dark and light mode. Your choice is saved on this device.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-3 rounded-lg border transition-all flex items-center gap-2 font-display font-bold ${theme === 'dark' ? 'bg-brand/10 border-brand/40 text-brand' : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="material-symbols-outlined">dark_mode</span>
              Dark Mode
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-3 rounded-lg border transition-all flex items-center gap-2 font-display font-bold ${theme === 'light' ? 'bg-brand/10 border-brand/40 text-brand' : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="material-symbols-outlined">light_mode</span>
              Light Mode
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
