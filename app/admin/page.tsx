'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PageHeader,
  PageCard,
  StatusBadge,
  tableWrapCls,
  paginationCls,
  thCls,
  tdCls,
  inputCls,
  SectionTitle,
} from '@/components/ui/design-system'

type Quote = {
  id: number
  quote_number: string
  customer_id: number
  product_id: number
  status: string
  final_total: number
  created_at: string
}

const STATUSES = ['', 'Sent', 'EmailFailed', 'Approved', 'Invoiced'] as const

export default function AdminDashboardPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('qg_quote_email_notice')
      if (msg) {
        setEmailNotice(msg)
        sessionStorage.removeItem('qg_quote_email_notice')
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // Load all quotes once; status and search filters are applied client-side.
    fetch('/api/quotes', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const sorted = [...res.data].sort(
            (a: Quote, b: Quote) => a.id - b.id
          )
          setQuotes(sorted)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredQuotes = quotes.filter((q) => {
    if (statusFilter) {
      if (q.status !== statusFilter) return false
    }

    if (!normalizedSearch) return true

    const idText = String(q.id)
    const quoteNo = q.quote_number.toLowerCase()
    const statusText = q.status.toLowerCase()
    return (
      idText.includes(normalizedSearch) ||
      quoteNo.includes(normalizedSearch) ||
      statusText.includes(normalizedSearch)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const visibleQuotes = filteredQuotes.slice(startIndex, endIndex)

  return (
    <section className="w-full min-w-0 space-y-8">
      <PageHeader
        title="Admin — Quotations"
        description="Oversee every quotation created across SP Interior Solutions and keep the product and pricing catalog up to date."
      />

      {emailNotice && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="min-w-0 flex-1">{emailNotice}</p>
          <button
            type="button"
            onClick={() => setEmailNotice(null)}
            className="shrink-0 font-medium text-amber-800 underline hover:text-amber-950"
          >
            Dismiss
          </button>
        </div>
      )}

      <PageCard className="max-w-xl space-y-4">
        <SectionTitle>Filter</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputCls(false)}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s === ''
                    ? 'All'
                    : s === 'Sent'
                      ? 'Mail sent'
                      : s === 'EmailFailed'
                        ? 'Email failed'
                        : s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by quote # or status…"
              className={inputCls(false)}
            />
          </div>
        </div>
      </PageCard>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/50">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      ) : (
        <div className={tableWrapCls}>
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Quote #</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Total</th>
                <th className={thCls}>Created</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                  <td className={tdCls + ' font-medium'}>{q.quote_number}</td>
                  <td className={tdCls}>
                    <StatusBadge status={q.status} />
                  </td>
                  <td className={tdCls + ' tabular-nums'}>
                    {Number(q.final_total).toFixed(2)}
                  </td>
                  <td className={tdCls + ' text-slate-600'}>{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className={tdCls + ' text-right'}>
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    <Link
                      href={`/admin/quotes/${q.id}`}
                      className="font-medium text-purple-600 hover:text-purple-700 no-underline hover:underline"
                    >
                      View
                    </Link>
                    <a
                      href={`/api/quotes/${q.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
                    >
                      View PDF
                    </a>
                    <a
                      href={`/api/quotes/${q.id}/pdf`}
                      download={`quote-${q.quote_number}.pdf`}
                      className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
                    >
                      Download PDF
                    </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredQuotes.length > 0 && (
            <div className={paginationCls}>
              <span>
                Showing {startIndex + 1}–{Math.min(endIndex, filteredQuotes.length)} of {filteredQuotes.length}
              </span>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-1 text-base font-semibold uppercase tracking-wide text-slate-700">
          Product &amp; pricing setup
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Maintain the official SP Interior Solutions ranges, fabric groups and roller pricing rules used on every quotation PDF.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/admin/products"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Products
          </Link>
          <Link
            href="/admin/fabric-groups"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Fabric groups
          </Link>
          <Link
            href="/admin/widths"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Widths
          </Link>
          <Link
            href="/admin/drops"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Drops
          </Link>
          <Link
            href="/admin/pricing-grid"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Pricing grid
          </Link>
          <Link
            href="/admin/costing-rules"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-md shadow-slate-200/50 transition hover:border-purple-300 hover:bg-purple-50/50 no-underline"
          >
            Costing rules
          </Link>
        </div>
      </div>
    </section>
  )
}
