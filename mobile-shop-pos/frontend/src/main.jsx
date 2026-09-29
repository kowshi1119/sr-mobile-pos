import '@fontsource-variable/syne'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/material-symbols-outlined'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { showAlert } from './dialogs'

// Safety net: a failed save that a page forgot to handle still tells the user what went wrong.
window.addEventListener('unhandledrejection', event => {
  const err = event.reason
  if (!err?.isAxiosError) return
  event.preventDefault()
  if (err.response?.status === 401) return
  showAlert(err.response?.data?.error || (err.response ? 'The request could not be completed.' : 'Cannot reach the POS service. Please restart SR Mobile POS.'))
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
