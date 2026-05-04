'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { PageCard } from '@/components/ui/design-system'

const COMPANY_NAME = 'Quote Generator'

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email.trim())) return 'Enter a valid email address'
  return null
}

function validatePassword(password: string, isLogin: boolean): string | null {
  if (!password) return 'Password is required'
  if (!isLogin && password.length < 6) return 'Password must be at least 6 characters'
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function runValidation(): boolean {
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password, true)
    setErrors({ email: emailErr ?? undefined, password: passwordErr ?? undefined })
    setServerError('')
    return !emailErr && !passwordErr
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!runValidation()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error || 'Login failed')
        setLoading(false)
        return
      }
      if (data.data?.user?.role === 'admin') router.push('/admin')
      else router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Login failed')
    }
    setLoading(false)
  }

  const inputErr = (has: boolean) =>
    has
      ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-purple-500 focus:ring-purple-500/20'

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-12 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">
              {COMPANY_NAME}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
              Sign in to your account
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Enter your email and password to access the dashboard.
            </p>
          </div>

          <PageCard className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrors((x) => ({ ...x, email: undefined }))
                  }}
                  className={`block w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:opacity-60 ${inputErr(!!errors.email)}`}
                  placeholder="you@company.com"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((x) => ({ ...x, password: undefined }))
                  }}
                  className={`block w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:opacity-60 ${inputErr(!!errors.password)}`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
                )}
                <div className="mt-2 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {serverError && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-purple-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold text-purple-600 hover:text-purple-700 hover:underline"
              >
                Create one
              </Link>
            </p>
          </PageCard>
        </div>
      </div>

      {/* Brand panel */}
      <div className="hidden lg:flex lg:flex-1 flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-purple-600 to-purple-800 px-12 py-16">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            {COMPANY_NAME}
          </div>
          <h2 className="mt-8 text-2xl font-bold leading-tight text-white sm:text-3xl">
            Generate and manage quotations in minutes
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/90">
            Keep customer details, pricing rules, and quotes in one place—built
            for roller blinds and window coverings.
          </p>
        </div>
      </div>
    </div>
  )
}
