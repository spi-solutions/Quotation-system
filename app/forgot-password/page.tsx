'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageCard } from '@/components/ui/design-system'

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email.trim())) return 'Enter a valid email address'
  return null
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      setMessage('')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Unable to process request')
      } else {
        setMessage(
          data.data?.message ||
            'If an account exists for that email, a reset link has been sent.'
        )
      }
    } catch {
      setError('Unable to process request')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <PageCard className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we&apos;ll send you a password reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="block w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                placeholder="you@company.com"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-purple-700 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/login"
              className="font-semibold text-purple-600 hover:text-purple-700 hover:underline"
            >
              Back to login
            </Link>
          </p>
        </PageCard>
      </div>
    </div>
  )
}
