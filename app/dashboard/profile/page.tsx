'use client'

import { useEffect, useState } from 'react'
import {
  PageHeader,
  PageCard,
  SectionTitle,
  inputCls,
  btnPrimary,
  btnSecondary,
  errorCls,
} from '@/components/ui/design-system'

type Profile = {
  id: number
  auth_user_id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  role: string
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [isAdmin, setIsAdmin] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, meRes] = await Promise.all([
          fetch('/api/profile', { credentials: 'include' }),
          fetch('/api/auth/me', { credentials: 'include' }),
        ])

        let meBody: any | null = null
        if (meRes.ok) {
          meBody = await meRes.json()
          const role = meBody?.data?.user?.role
          setIsAdmin(role === 'admin')
        }

        if (profileRes.ok) {
          const body = await profileRes.json()
          setProfile(body.data)
          setForm({
            name: body.data?.name ?? '',
            email: body.data?.email ?? '',
            phone: body.data?.phone ?? '',
            address: body.data?.address ?? '',
          })
          setMode('view')
          return
        }

        if (profileRes.status === 404 || profileRes.status === 401) {
          const emailFromMe =
            (meBody?.data?.user?.email as string | undefined) ?? ''
          if (emailFromMe) {
            setForm((f) => ({
              ...f,
              email: emailFromMe,
            }))
          }
          setProfile(null)
          setMode('view')
          return
        }

        setProfile(null)
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!emailRe.test(form.email.trim())) e.email = 'Enter a valid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors({ submit: data.error || 'Update failed' })
        setSaving(false)
        return
      }
      setProfile(data.data)
      setForm({
        name: data.data?.name ?? '',
        email: data.data?.email ?? '',
        phone: data.data?.phone ?? '',
        address: data.data?.address ?? '',
      })
      setSuccess(true)
      setErrors({})
      setMode('view')
    } catch {
      setErrors({ submit: 'Update failed' })
    }
    setSaving(false)
  }

  function validatePasswordForm(): boolean {
    const e: Record<string, string> = {}
    if (!passwordForm.currentPassword) e.currentPassword = 'Enter your current password'
    if (!passwordForm.newPassword) e.newPassword = 'Enter a new password'
    else if (passwordForm.newPassword.length < 8)
      e.newPassword = 'New password must be at least 8 characters'
    if (!passwordForm.confirmPassword) e.confirmPassword = 'Confirm your new password'
    else if (passwordForm.newPassword !== passwordForm.confirmPassword)
      e.confirmPassword = 'New password and confirmation must match'
    setPasswordErrors(e)
    return Object.keys(e).length === 0
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSuccess(false)
    if (!validatePasswordForm()) return
    setPasswordSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordErrors({ submit: data.error || 'Failed to change password' })
        setPasswordSaving(false)
        return
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
      setPasswordSuccess(true)
    } catch {
      setPasswordErrors({ submit: 'Failed to change password' })
    }
    setPasswordSaving(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading profile…</p>
      </div>
    )
  }

  return (
    <section className="w-full min-w-0 max-w-5xl space-y-8">
      <PageHeader
        title="Profile"
        description="Your SP Interior Solutions contact details used on every quotation."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
        {mode === 'view' && (
          <PageCard>
            <SectionTitle>Contact information</SectionTitle>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Name
                </p>
                <p className="mt-1.5 text-base text-slate-800">{form.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email
                </p>
                <p className="mt-1.5 break-all text-base text-slate-800">
                  {form.email || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Phone
                </p>
                <p className="mt-1.5 text-base text-slate-800">
                  {form.phone || '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Address
                </p>
                <p className="mt-1.5 whitespace-pre-line text-base text-slate-800">
                  {form.address || '—'}
                </p>
              </div>
            </div>
            {success && (
              <p className="mt-4 rounded-xl bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 ring-1 ring-purple-200">
                Profile updated.
              </p>
            )}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => {
                  setErrors({})
                  setSuccess(false)
                  setMode('edit')
                }}
                className={btnPrimary}
              >
                Edit profile
              </button>
            </div>
          </PageCard>
        )}

        {mode === 'edit' && (
          <PageCard>
            <SectionTitle>Edit contact information</SectionTitle>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls(!!errors.name)}
                  required
                  disabled={saving}
                />
                {errors.name && <p className={errorCls}>{errors.name}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputCls(!!errors.email)}
                  required
                  disabled={saving}
                />
                {errors.email && <p className={errorCls}>{errors.email}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={inputCls(false)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  rows={3}
                  className={inputCls(false) + ' resize-none'}
                  disabled={saving}
                />
              </div>
              {errors.submit && <p className={errorCls}>{errors.submit}</p>}
              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? 'Saving…' : profile ? 'Update profile' : 'Create profile'}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setErrors({})
                    setSuccess(false)
                    setMode('view')
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </PageCard>
        )}

        <PageCard className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
            SP Interior Solutions
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Put a friendly face to every quotation
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Customers see these details at the top of their quotation PDF. A clear
            name, direct contact number and address make it easy for them to reach
            you and confirm their blinds or shutters order.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Use your full name as it should appear on quotes.</li>
            <li>Add the best phone number for installation or design questions.</li>
            <li>Include a service area or showroom address where relevant.</li>
          </ul>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">
              {form.name ? form.name.charAt(0).toUpperCase() : 'SP'}
            </div>
            <p className="text-xs italic text-slate-600">
              “We believe windows are more than just openings — they&apos;re the soul of
              your space, where light, comfort and emotion flow through.”
            </p>
          </div>
        </PageCard>

        {isAdmin && (
          <PageCard className="space-y-5">
            <SectionTitle>Change admin password</SectionTitle>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Current password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                  className={inputCls(!!passwordErrors.currentPassword)}
                  disabled={passwordSaving}
                />
                {passwordErrors.currentPassword && (
                  <p className={errorCls}>{passwordErrors.currentPassword}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                  className={inputCls(!!passwordErrors.newPassword)}
                  disabled={passwordSaving}
                />
                {passwordErrors.newPassword && (
                  <p className={errorCls}>{passwordErrors.newPassword}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  className={inputCls(!!passwordErrors.confirmPassword)}
                  disabled={passwordSaving}
                />
                {passwordErrors.confirmPassword && (
                  <p className={errorCls}>{passwordErrors.confirmPassword}</p>
                )}
              </div>
              {passwordErrors.submit && (
                <p className={errorCls}>{passwordErrors.submit}</p>
              )}
              {passwordSuccess && (
                <p className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Password updated successfully.
                </p>
              )}
              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
        </PageCard>
        )}
      </div>
    </section>
  )
}
