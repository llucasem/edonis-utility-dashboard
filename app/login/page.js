'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      const from = searchParams.get('from') || '/'
      router.push(from)
    } else {
      setError('Incorrect password. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EDE8DF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Lora', serif",
    }}>
      <div style={{
        background: '#F7F4EE',
        border: '1px solid #D4C5AE',
        borderRadius: 16,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 4px 24px rgba(45,31,14,0.10)',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            fontWeight: 700,
            color: '#2D1F0E',
            marginBottom: 8,
          }}>
            Utility Dashboard
          </h1>
          <p style={{ color: '#6B4F2E', fontSize: 14 }}>
            The Dream Management LLC
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #D4C5AE',
              borderRadius: 8,
              background: '#EDE8DF',
              color: '#2D1F0E',
              fontSize: 15,
              fontFamily: "'Lora', serif",
              outline: 'none',
              marginBottom: 16,
            }}
          />
          {error && (
            <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#A08060' : '#8B6343',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontFamily: "'Lora', serif",
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
