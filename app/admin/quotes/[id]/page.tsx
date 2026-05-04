'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CopyPlus } from 'lucide-react'
import {
  PageCard,
  StatusBadge,
  backLinkCls,
  btnPrimary,
  labelCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
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
  created_at: string
  additional_info?: string | null
  xero_invoice_id?: string | null
  xero_sync_error?: string | null
}

type QuoteItem = {
  id: number
  quote_id: number
  product_id: number
  fabric_group_id: number
  input_width: number
  input_drop: number
  base_price: number
  subtotal: number
  gst: number
  final_total: number
  quantity?: number
  location_label: string
  location_other: string | null
}

type Customer = {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  xero_contact_id?: string | null
}

const STATUSES = ['Draft', 'Sent', 'EmailFailed', 'Approved', 'Invoiced'] as const

export default function AdminQuoteDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<{ id: number; name: string }[]>([])
  const [fabricGroups, setFabricGroups] = useState<{ id: number; group_number: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/quotes/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/products', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/fabric-groups', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([res, pRes, fRes]) => {
        const data = res.data
        if (!data) return
        const { customer: c, items: rawItems, ...quoteRow } = data
        setQuote(quoteRow as Quote)
        setCustomer(c ?? null)
        setItems(Array.isArray(rawItems) ? rawItems : [])
        setNewStatus(data.status ?? '')
        if (pRes.data) setProducts(pRes.data)
        if (fRes.data) setFabricGroups(fRes.data)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!newStatus || newStatus === quote?.status) return
    setUpdating(true)
    setError('')
    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        setQuote(data.data)
        setNewStatus(data.data?.status ?? '')
      } else setError(data.error || 'Update failed')
    } catch {
      setError('Update failed')
    }
    setUpdating(false)
  }

  /** Rows to show: quote_items if any, else legacy single line from quote header */
  const displayRows: QuoteItem[] =
    items.length > 0
      ? items
      : quote
        ? [
            {
              id: 0,
              quote_id: quote.id,
              product_id: quote.product_id,
              fabric_group_id: quote.fabric_group_id,
              input_width: quote.input_width,
              input_drop: quote.input_drop,
              base_price: Number(quote.base_price),
              subtotal: Number(quote.subtotal),
              gst: Number(quote.gst),
              final_total: Number(quote.final_total),
              quantity: 1,
              location_label: '—',
              location_other: null,
            },
          ]
        : []

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!quote) {
    return (
      <section className="w-full min-w-0 space-y-4">
        <Link href="/admin" className={backLinkCls}>← Dashboard</Link>
        <p className="text-slate-700">Quote not found.</p>
      </section>
    )
  }

  return (
    <section className="w-full min-w-0 max-w-4xl space-y-6">
      <Link href="/admin" className={backLinkCls}>← Dashboard</Link>

      <PageCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Quote {quote.quote_number}
          </h1>
          <StatusBadge status={quote.status} />
        </div>

        {customer && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{customer.name}</span>
            {' · '}
            {customer.email}
          </p>
        )}

        <dl className="mt-4 grid gap-4 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current status</dt>
            <dd className="mt-1 font-medium text-slate-800">
              <StatusBadge status={quote.status} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Xero</dt>
            <dd className="mt-1 space-y-1 text-slate-800">
              <p>
                <span className="text-slate-500">Contact ID: </span>
                {customer?.xero_contact_id?.trim()
                  ? (
                    <span className="font-mono text-xs">{customer.xero_contact_id}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
              </p>
              <p>
                <span className="text-slate-500">Draft invoice ID: </span>
                {quote.xero_invoice_id?.trim()
                  ? (
                    <span className="font-mono text-xs">{quote.xero_invoice_id}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
              </p>
              {quote.xero_sync_error?.trim() ? (
                <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                  <span className="font-medium">Sync error: </span>
                  {quote.xero_sync_error}
                </p>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Product lines</h2>
          <div className={tableWrapCls + ' mt-2'}>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>Location</th>
                  <th className={thCls}>Product</th>
                  <th className={thCls}>Fabric</th>
                  <th className={thCls}>Width</th>
                  <th className={thCls}>Drop</th>
                  <th className={thCls}>Qty</th>
                  <th className={thCls + ' text-right'}>Base</th>
                  <th className={thCls + ' text-right'}>Subtotal</th>
                  <th className={thCls + ' text-right'}>GST</th>
                  <th className={thCls + ' text-right'}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const product = products.find((p) => p.id === row.product_id)
                  const fabric = fabricGroups.find((g) => g.id === row.fabric_group_id)
                  const loc =
                    row.location_label === '—'
                      ? '—'
                      : row.location_label === 'Other' && row.location_other
                        ? row.location_other
                        : row.location_label
                  return (
                    <tr key={row.id || index} className="hover:bg-slate-50/80">
                      <td className={tdCls}>{index + 1}</td>
                      <td className={tdCls}>{loc}</td>
                      <td className={tdCls}>{product?.name ?? `Product #${row.product_id}`}</td>
                      <td className={tdCls}>{fabric ? `Group ${fabric.group_number}` : '—'}</td>
                      <td className={tdCls}>{row.input_width}</td>
                      <td className={tdCls}>{row.input_drop}</td>
                      <td className={tdCls}>{row.quantity != null && row.quantity >= 1 ? row.quantity : 1}</td>
                      <td className={tdCls + ' text-right'}>{Number(row.base_price).toFixed(2)}</td>
                      <td className={tdCls + ' text-right'}>{Number(row.subtotal).toFixed(2)}</td>
                      <td className={tdCls + ' text-right'}>{Number(row.gst).toFixed(2)}</td>
                      <td className={tdCls + ' text-right font-medium'}>{Number(row.final_total).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Quote totals (sum of lines)</h2>
          <dl className="mt-2 text-sm text-slate-700">
            <dd>
              Subtotal {Number(quote.subtotal).toFixed(2)} · GST {Number(quote.gst).toFixed(2)} ·{' '}
              <strong className="text-slate-900">Total {Number(quote.final_total).toFixed(2)}</strong>
            </dd>
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/admin/quotes/new?from=${quote.id}`}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:border-purple-400 hover:bg-purple-100"
          >
            <CopyPlus className="h-4 w-4" aria-hidden="true" />
            Create new version
          </Link>
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

        <form onSubmit={handleStatusUpdate} className="mt-6 flex flex-wrap items-end gap-4 border-t border-slate-200 pt-6">
          <div className="min-w-[160px]">
            <label className={labelCls}>Update status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className={inputCls(false)}
              disabled={updating}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className={btnPrimary}
            disabled={updating || newStatus === quote.status}
          >
            {updating ? 'Updating…' : 'Update'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}
      </PageCard>
    </section>
  )
}
