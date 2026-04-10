import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeCtx = createContext(null)
const STORAGE_KEY = 'sr-mobile-pos-theme'

function normalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark'
}

function applyTheme(theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return normalizeTheme(localStorage.getItem(STORAGE_KEY) || 'dark')
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = nextTheme => setThemeState(normalizeTheme(nextTheme))
  const toggleTheme = () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }), [theme])

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useTheme() {
  const context = useContext(ThemeCtx)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
