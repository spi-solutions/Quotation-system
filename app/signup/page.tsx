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

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 6) return 'Password must be at least 6 characters'
  return null
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
    confirm?: string
  }>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function runValidation(): boolean {
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)
    const confirmErr =
      password !== confirmPassword ? 'Passwords do not match' : undefined
    setErrors({
      email: emailErr ?? undefined,
      password: passwordErr ?? undefined,
      confirm: confirmErr,
    })
    setServerError('')
    return !emailErr && !passwordErr && !confirmErr
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!runValidation()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error || 'Signup failed')
        setLoading(false)
        return
      }
      if (data.data?.user?.role === 'admin') router.push('/admin')
      else router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Signup failed')
    }
    setLoading(false)
  }

  const inputErr = (has: boolean) =>
    has
      ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-purple-500 focus:ring-purple-500/20'

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden lg:flex-row-reverse">
      {/* Form side */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-12 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">
              {COMPANY_NAME}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
              Create your account
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Use your work email so your quotes stay in one place.
            </p>
          </div>

          <PageCard className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="signup-email"
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
                  htmlFor="signup-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((x) => ({ ...x, password: undefined, confirm: undefined }))
                  }}
                  className={`block w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:opacity-60 ${inputErr(!!errors.password)}`}
                  placeholder="At least 6 characters"
                  disabled={loading}
                />
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-confirm"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirm password
                </label>
                <input
                  id="signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setErrors((x) => ({ ...x, confirm: undefined }))
                  }}
                  className={`block w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:opacity-60 ${inputErr(!!errors.confirm)}`}
                  placeholder="Repeat password"
                  disabled={loading}
                />
                {errors.confirm && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.confirm}</p>
                )}
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
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-purple-600 hover:text-purple-700 hover:underline"
              >
                Sign in
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
            Start generating professional quotes today
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/90">
            Designed for teams that send detailed window-covering quotations and
            need a clear, auditable workflow.
          </p>
        </div>
      </div>
    </div>
  )
}
