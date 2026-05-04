'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  UserCircle2,
  Package2,
  Layers3,
  ArrowLeftRight,
  ArrowUpDown,
  Grid3X3,
  Calculator,
  Menu,
  X,
  FilePlus2,
} from 'lucide-react'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/quotes/new', label: 'New quote', icon: FilePlus2 },
  { href: '/admin/profile', label: 'Profile', icon: UserCircle2 },
  { href: '/admin/products', label: 'Products', icon: Package2 },
  { href: '/admin/fabric-groups', label: 'Fabric groups', icon: Layers3 },
  { href: '/admin/widths', label: 'Widths', icon: ArrowLeftRight },
  { href: '/admin/drops', label: 'Drops', icon: ArrowUpDown },
  { href: '/admin/pricing-grid', label: 'Pricing grid', icon: Grid3X3 },
  { href: '/admin/costing-rules', label: 'Costing rules', icon: Calculator },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          router.replace('/login')
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data?.data?.user?.role !== 'admin') {
          router.replace('/dashboard')
          return
        }
        setLoading(false)
      })
  }, [router])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading admin…</p>
        </div>
      </div>
    )
  }

  const navLinks = (
    <>
      {adminNavItems.map((item) => {
        const Icon = item.icon
        const isRoot = item.href === '/admin'
        const active = isRoot
          ? pathname === '/admin'
          : pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition no-underline border-b-2 ${
              active
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-800">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2.5 text-slate-800 no-underline hover:no-underline"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src="https://spisolutions.com.au/wp-content/uploads/2025/04/spis_logo_v4.png"
              alt="SP Interior Solutions"
              className="h-9 w-auto sm:h-10"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden flex-1 items-center justify-end gap-2 lg:flex">
            <div className="flex overflow-x-auto px-1 py-1 text-sm gap-1">
              {navLinks}
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center text-sm font-medium text-slate-600 transition hover:text-red-600"
              onClick={async () => {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  credentials: 'include',
                })
                router.push('/login')
                router.refresh()
              }}
            >
              Sign out
            </button>
          </div>

          {/* Mobile: burger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="size-6" aria-hidden="true" />
              ) : (
                <Menu className="size-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isRoot = item.href === '/admin'
                const active = isRoot
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium no-underline ${
                      active
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false)
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                  })
                  router.push('/login')
                  router.refresh()
                }}
                className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  )
}
