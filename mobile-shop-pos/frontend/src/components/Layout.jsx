import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ScannerProvider, useScanner } from '../context/ScannerContext'
import AiWidget from './AiWidget'

const NAV = [
  { to: '/dashboard',    icon: 'dashboard',     label: 'Dashboard' },
  { to: '/billing',      icon: 'point_of_sale', label: 'New Sale' },
  { to: '/products',     icon: 'inventory_2',   label: 'Products' },
  { to: '/categories',   icon: 'category',      label: 'Categories' },
  { to: '/customers',    icon: 'people',        label: 'Customers' },
  { to: '/repairs',      icon: 'build',         label: 'Repairs' },
  { to: '/notifications',icon: 'notifications', label: 'Messages' },
]

export default function Layout() {
  return (
    <ScannerProvider>
      <LayoutInner />
    </ScannerProvider>
  )
}

function LayoutInner() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const { openScanner } = useScanner()
  const [sideOpen, setSideOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-surface-lowest">
      {/* Sidebar */}
      <aside className={`${sideOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col bg-surface border-r border-white/5 transition-all duration-200 z-30`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/5 gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-onbrand text-lg fill-icon">storefront</span>
          </div>
          {sideOpen && (
            <div className="overflow-hidden">
              <p className="font-display font-bold text-white text-sm leading-tight">S R Mobile</p>
              <p className="text-white/30 text-[10px] font-mono">Chunnakam</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${!sideOpen ? 'justify-center px-2' : ''}`}>
              <span className="material-symbols-outlined text-xl flex-shrink-0">{n.icon}</span>
              {sideOpen && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/5">
          <button onClick={logout} className={`nav-item w-full ${!sideOpen ? 'justify-center px-2' : ''}`}>
            <span className="material-symbols-outlined text-xl text-red-400">logout</span>
            {sideOpen && <span className="text-red-400">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-surface border-b border-white/5 flex-shrink-0">
          <button onClick={() => setSideOpen(v => !v)} className="text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-white/30 text-sm font-mono hidden sm:block">{admin?.email}</span>
            <button onClick={() => navigate('/billing')} className="btn-primary py-2 px-4 text-sm hidden sm:flex">
              <span className="material-symbols-outlined text-sm">add</span> New Sale
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* AI Widget */}
      <AiWidget />

      {/* Global QR Scanner FAB */}
      <button
        onClick={openScanner}
        title="Scan to Add Product"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-brand text-onbrand rounded-full shadow-lg hover:bg-brand/90 active:scale-95 transition-all font-mono text-sm font-bold"
      >
        <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
        <span className="hidden sm:inline">Scan Product</span>
      </button>
    </div>
  )
}
