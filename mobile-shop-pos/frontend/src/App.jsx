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

function PrivateRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-surface-lowest"><span className="material-symbols-outlined text-brand text-4xl animate-spin">refresh</span></div>
  return admin ? children : <Navigate to="/login" replace />
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
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="bundles" element={<Bundles />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="billing" element={<Billing />} />
              <Route path="sale-success" element={<SaleSuccess />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="repairs" element={<Repairs />} />
              <Route path="repairs/:id" element={<RepairDetail />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="data" element={<DataBackup />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
