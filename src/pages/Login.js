import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ password })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoMark}>TB</div>
          <span style={styles.logoBrandName}>Tess Buddy</span>
        </div>
        <p style={styles.subtitle}>Tessitura Management Portal</p>

        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#f0f7ff',
    backgroundImage: 'linear-gradient(rgba(29,111,219,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(29,111,219,0.06) 1px, transparent 1px)',
    backgroundSize: '60px 60px',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    padding: '48px',
    borderRadius: '16px',
    boxShadow: '0 4px 40px rgba(29,111,219,0.12)',
    border: '1px solid rgba(29,111,219,0.14)',
    width: '100%',
    maxWidth: '420px',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  logoMark: {
    width: '40px', height: '40px',
    background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: '700', fontSize: '16px', color: '#fff', flexShrink: 0,
  },
  logoBrandName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '22px', fontWeight: '700', color: '#0c1a33', letterSpacing: '-0.4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: '32px',
  },
  field: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0c1a33',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(29,111,219,0.22)',
    backgroundColor: '#fff',
    color: '#0c1a33',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: '0 4px 24px rgba(29,111,219,0.28)',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
    marginBottom: '12px',
  },
  forgotLink: {
    fontSize: '13px',
    color: '#1d6fdb',
    textAlign: 'center',
    marginTop: '16px',
    cursor: 'pointer',
  }
}

export default Login