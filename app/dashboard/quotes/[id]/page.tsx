'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  PageCard,
  StatusBadge,
  backLinkCls,
} from '@/components/ui/design-system'

type Quote = {
  id: number
  quote_number: string
  customer_id: number
  product_id: number
  fabric_group_id: number
  input_width: number
  input_drop: number
  base_price: number
  subtotal: number
  gst: number
  final_total: number
  status: string
  created_by_user_id: string | null
  created_at: string
}

export default function QuoteDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [quote, setQuote] = useState<Quote | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/quotes/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([quoteRes, meRes]) => {
        setQuote(quoteRes.data)
        if (quoteRes.error) setError(quoteRes.error)
        if (meRes?.data?.user) setCurrentUser({ id: String(meRes.data.user.id), role: meRes.data.user.role || 'user' })
      })
      .catch(() => setError('Failed to load quote'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleStatusUpdate() {
    if (!quote || quote.status !== 'Draft') return
    setUpdating(true)
    setError('')
    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'Sent' }),
      })
      const data = await res.json()
      if (res.ok) setQuote(data.data)
      else setError(data.error || 'Update failed')
    } catch {
      setError('Update failed')
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!quote) {
    return (
      <section className="w-full min-w-0 max-w-2xl space-y-6">
        <Link href="/dashboard/quotes" className={backLinkCls}>
          ← My quotations
        </Link>
        <PageCard>
          <p className="text-slate-700">Quote not found.</p>
        </PageCard>
      </section>
    )
  }

  return (
    <section className="w-full min-w-0 max-w-2xl space-y-6">
      <Link href="/dashboard/quotes" className={backLinkCls}>
        ← My quotations
      </Link>

      <PageCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Quote {quote.quote_number}
          </h1>
          <StatusBadge status={quote.status} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          A detailed summary of pricing and measurements for this SP Interior Solutions quotation.
        </p>
        <dl className="mt-5 grid gap-5 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</dt>
            <dd className="mt-1 font-medium text-slate-800">
              {quote.status === 'Approved'
                ? 'Quote accepted'
                : quote.status === 'Invoiced'
                  ? 'Invoiced'
                  : quote.status === 'EmailQueued'
                    ? 'Mail sent'
                  : quote.status === 'Sent'
                    ? 'Mail sent'
                    : quote.status === 'EmailFailed'
                      ? 'Email failed'
                      : quote.status === 'Draft'
                        ? 'Draft'
                        : quote.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Input</dt>
            <dd className="mt-1 text-slate-700">Width {quote.input_width}, drop {quote.input_drop}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pricing</dt>
            <dd className="mt-1 text-slate-700">
              Base {Number(quote.base_price).toFixed(2)} · Subtotal {Number(quote.subtotal).toFixed(2)} · GST {Number(quote.gst).toFixed(2)} · <strong className="text-slate-900">Total {Number(quote.final_total).toFixed(2)}</strong>
            </dd>
          </div>
        </dl>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-purple-400 hover:text-purple-700"
          >
            View PDF
          </a>
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            download={`quote-${quote.quote_number}.pdf`}
            className="inline-flex items-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-purple-400 hover:text-purple-700"
          >
            Download PDF
          </a>
        </div>
      </PageCard>
    </section>
  )
}
