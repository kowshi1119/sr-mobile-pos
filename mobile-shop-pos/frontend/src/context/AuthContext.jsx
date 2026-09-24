import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { PAGES } from '../permissions'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me').then(r => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', data.token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  // Used after a password change, which issues a new token.
  const setSession = (token, next) => {
    localStorage.setItem('token', token)
    setUser(u => ({ ...u, ...next }))
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const isOwner = user?.role === 'OWNER'
  // True when the user has any one of the given permissions; the owner has all of them.
  const can = useCallback((...keys) => !!user && (user.role === 'OWNER' || keys.flat().some(k => user.permissions?.includes(k))), [user])
  const canOpen = useCallback(page => page.perm === 'owner' ? isOwner : !page.perm || can(page.perm), [can, isOwner])
  const home = PAGES.find(p => canOpen(p))?.to || '/no-access'

  return (
    <AuthCtx.Provider value={{ user, admin: user, isOwner, can, canOpen, home, login, logout, setSession, loading }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
