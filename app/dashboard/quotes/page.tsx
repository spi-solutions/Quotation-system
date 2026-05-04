'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PageHeader,
  StatusBadge,
  tableWrapCls,
  paginationCls,
  thCls,
  tdCls,
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

export default function MyQuotationsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const pageSize = 10

  useEffect(() => {
    fetch('/api/quotes', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const sorted = [...res.data].sort(
            (a: Quote, b: Quote) => a.id - b.id
          )
          setQuotes(sorted)
        }
        if (res.error) setError(res.error)
      })
      .catch(() => setError('Failed to load quotations'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAccept(id: number) {
    setUpdatingId(id)
    setError('')
    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'Approved' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to accept quote')
      } else if (data.data) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? data.data : q)))
      }
    } catch {
      setError('Failed to accept quote')
    }
    setUpdatingId(null)
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredQuotes = quotes.filter((q) => {
    const matchesStatus =
      !statusFilter || q.status.toLowerCase() === statusFilter.toLowerCase()

    if (!normalizedSearch) return matchesStatus

    const idText = String(q.id)
    const quoteNo = q.quote_number.toLowerCase()
    const statusText = q.status.toLowerCase()
    return (
      matchesStatus &&
      (idText.includes(normalizedSearch) ||
        quoteNo.includes(normalizedSearch) ||
        statusText.includes(normalizedSearch))
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
        title="My quotations"
        description="Track every SP Interior Solutions quotation you’ve created, from mail sent through to quote accepted and invoiced."
      />

      {!loading && quotes.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-48 items-center gap-2 sm:basis-auto">
            <label className="shrink-0 text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="">All</option>
              <option value="Sent">Mail sent</option>
              <option value="EmailFailed">Email failed</option>
              <option value="Approved">Quote accepted</option>
              <option value="Invoiced">Invoiced</option>
            </select>
          </div>
          <div className="w-full min-w-0 sm:w-auto sm:min-w-[12rem]">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by quote # or status…"
              className="block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 sm:max-w-xs"
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/50">
          <p className="text-sm text-slate-500">Loading quotations…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {!loading && !error && quotes.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md shadow-slate-200/50">
          <p className="text-base font-semibold text-slate-800">
            You don&apos;t have any quotations yet.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Quotations are created by SP Interior Solutions and sent to you by email. When you receive one, it will appear here so you can view, download the PDF, or accept the quote.
          </p>
        </div>
      )}

      {!loading && quotes.length > 0 && (
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
                  <td className={tdCls + ' text-right space-x-3'}>
                    <a
                      href={`/api/quotes/${q.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-purple-600 underline-offset-2 hover:text-purple-700 hover:underline"
                    >
                      View PDF
                    </a>
                    <a
                      href={`/api/quotes/${q.id}/pdf`}
                      download={`quote-${q.quote_number}.pdf`}
                      className="text-sm font-medium text-purple-600 underline-offset-2 hover:text-purple-700 hover:underline"
                    >
                      Download PDF
                    </a>
                    {(q.status === 'Sent' || q.status === 'EmailQueued') && (
                      <button
                        type="button"
                        onClick={() => handleAccept(q.id)}
                        disabled={updatingId === q.id}
                        className="rounded-full border border-purple-300 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                      >
                        {updatingId === q.id ? 'Updating…' : 'Accept quote'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        </div>
      )}
    </section>
  )
}
