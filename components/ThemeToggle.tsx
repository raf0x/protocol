'use client'

import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try { const t = localStorage.getItem('protocol-theme') || 'dark'; setTheme(t) } catch(e) {}
    setMounted(true)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('protocol-theme', next) } catch(e) {}
    document.documentElement.setAttribute('data-theme', next)
  }

  if (!mounted) return null

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 100,
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
