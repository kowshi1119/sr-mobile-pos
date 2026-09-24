import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Billing from './pages/Billing'
import SaleSuccess from './pages/SaleSuccess'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Repairs from './pages/Repairs'
import RepairDetail from './pages/RepairDetail'
import Notifications from './pages/Notifications'
import Analytics from './pages/Analytics'
import Suppliers from './pages/Suppliers'
import Expenses from './pages/Expenses'
import Bundles from './pages/Bundles'
import PublicInvoice from './pages/PublicInvoice'
import DataBackup from './pages/DataBackup'
import Users from './pages/Users'
import { PAGES } from './permissions'

function PrivateRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-surface-lowest"><span className="material-symbols-outlined text-brand text-4xl animate-spin">refresh</span></div>
  return admin ? children : <Navigate to="/login" replace />
}

// Pages the user may not open send them to the first page they can use.
function Allowed({ page, perm, children }) {
  const { can, canOpen, home } = useAuth()
  const config = page ? PAGES.find(p => p.to === page) : { perm }
  return canOpen(config) || (perm && can(perm)) ? children : <Navigate to={home} replace />
}

function Home() {
  const { home } = useAuth()
  return <Navigate to={home} replace />
}

function NoAccess() {
  return (
    <div className="card p-8 max-w-lg">
      <h1 className="font-display font-bold text-xl text-white">No pages available</h1>
      <p className="text-white/50 text-sm mt-2">Your account has no permissions yet. Ask the owner to give you access under Users &amp; Permissions.</p>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invoice/:invoiceNumber" element={<PublicInvoice />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="dashboard" element={<Allowed page="/dashboard"><Dashboard /></Allowed>} />
              <Route path="analytics" element={<Allowed page="/analytics"><Analytics /></Allowed>} />
              <Route path="suppliers" element={<Allowed page="/suppliers"><Suppliers /></Allowed>} />
              <Route path="expenses" element={<Allowed page="/expenses"><Expenses /></Allowed>} />
              <Route path="bundles" element={<Allowed page="/bundles"><Bundles /></Allowed>} />
              <Route path="products" element={<Allowed page="/products"><Products /></Allowed>} />
              <Route path="categories" element={<Allowed page="/categories"><Categories /></Allowed>} />
              <Route path="billing" element={<Allowed page="/billing"><Billing /></Allowed>} />
              <Route path="sale-success" element={<Allowed perm={['sales.create', 'sales.view']}><SaleSuccess /></Allowed>} />
              <Route path="customers" element={<Allowed page="/customers"><Customers /></Allowed>} />
              <Route path="customers/:id" element={<Allowed page="/customers"><CustomerDetail /></Allowed>} />
              <Route path="repairs" element={<Allowed page="/repairs"><Repairs /></Allowed>} />
              <Route path="repairs/:id" element={<Allowed page="/repairs"><RepairDetail /></Allowed>} />
              <Route path="notifications" element={<Allowed page="/notifications"><Notifications /></Allowed>} />
              <Route path="data" element={<Allowed page="/data"><DataBackup /></Allowed>} />
              <Route path="users" element={<Allowed page="/users"><Users /></Allowed>} />
              <Route path="no-access" element={<NoAccess />} />
            </Route>
            <Route path="*" element={<PrivateRoute><Home /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
