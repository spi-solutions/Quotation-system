'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { inputCls, btnPrimary, btnSecondary, btnDanger, cardCls, labelCls, tableWrapCls, paginationCls, thCls, tdCls, backLinkCls, PageHeader } from '@/components/ui/admin-form'

type Row = { id: number; drop_value: number }

export default function AdminDropsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ drop_value: '' })
  const [editing, setEditing] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [success, setSuccess] = useState('')
  const pageSize = 10

  function load() {
    fetch('/api/admin/drops', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const sorted = [...res.data].sort(
            (a: Row, b: Row) => a.id - b.id
          )
          setItems(sorted)
          setPage(1)
        }
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function validate(): boolean {
    const n = Number(form.drop_value)
    const e: Record<string, string> = {}
    if (form.drop_value === '' || isNaN(n) || n < 1) e.drop_value = 'Enter a valid drop (≥ 1)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSuccess('')
    try {
      const res = await fetch('/api/admin/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ drop_value: Number(form.drop_value) }),
      })
      const data = await res.json()
      if (res.ok) {
        setForm({ drop_value: '' })
        setErrors({})
        setSuccess('Drop added successfully.')
        load()
      } else {
        setErrors({ submit: data.error })
      }
    } finally { setSaving(false) }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (!validate()) return
    setSaving(true)
    setSuccess('')
    try {
      const res = await fetch('/api/admin/drops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: editing.id, drop_value: Number(form.drop_value) }),
      })
      const data = await res.json()
      if (res.ok) {
        setEditing(null)
        setForm({ drop_value: '' })
        setErrors({})
        setSuccess('Drop updated successfully.')
        load()
      } else {
        setErrors({ submit: data.error })
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete?')) return
    const res = await fetch('/api/admin/drops', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSuccess('Drop deleted successfully.')
      load()
    } else {
      alert((await res.json()).error)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredItems = normalizedSearch
    ? items.filter((row) => {
        const idText = String(row.id)
        const dropText = String(row.drop_value)
        return (
          idText.includes(normalizedSearch) ||
          dropText.includes(normalizedSearch)
        )
      })
    : items

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const visibleItems = filteredItems.slice(startIndex, endIndex)

  return (
    <section className="w-full min-w-0 space-y-6">
      <Link href="/admin" className={backLinkCls}>← Dashboard</Link>
      <PageHeader
        title="Drops"
        description="Store the standard finished drops (heights) used when calculating SP Interior Solutions roller blind pricing."
      />

      <div className={`${cardCls} max-w-sm`}>
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Edit drop</h3>
            <div className="space-y-2">
              <label className={labelCls}>Drop value *</label>
              <input type="number" min={1} value={form.drop_value} onChange={(e) => setForm({ drop_value: e.target.value })} className={inputCls(!!errors.drop_value)} required disabled={saving} />
              {errors.drop_value && <p className="text-sm text-red-600">{errors.drop_value}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" className={btnPrimary} disabled={saving}>Update</button>
              <button type="button" className={btnSecondary} onClick={() => { setEditing(null); setForm({ drop_value: '' }); setErrors({}); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Add drop</h3>
            <div className="space-y-2">
              <label className={labelCls}>Drop value *</label>
              <input type="number" min={1} value={form.drop_value} onChange={(e) => setForm({ drop_value: e.target.value })} className={inputCls(!!errors.drop_value)} required disabled={saving} />
              {errors.drop_value && <p className="text-sm text-red-600">{errors.drop_value}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>Add</button>
          </form>
        )}
      </div>

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search drops…"
              className={`${inputCls(false)} max-w-xs`}
            />
          </div>
          <div className={tableWrapCls}>
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>ID</th>
                <th className={thCls}>Drop</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className={tdCls}>{row.id}</td>
                  <td className={tdCls}>{row.drop_value}</td>
                  <td className={tdCls + ' text-right'}>
                    <button
                      type="button"
                      className={btnSecondary + ' mr-2'}
                      onClick={() => {
                        setEditing(row)
                        setForm({ drop_value: String(row.drop_value) })
                        setErrors({})
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className={btnDanger} onClick={() => handleDelete(row.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 0 && (
            <div className={paginationCls}>
              <span>
                Showing {startIndex + 1}–{Math.min(endIndex, filteredItems.length)} of {filteredItems.length}
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
        </div>
      )}
    </section>
  )
}
