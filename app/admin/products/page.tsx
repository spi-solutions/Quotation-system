'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { inputCls, btnPrimary, btnSecondary, btnDanger, cardCls, labelCls, tableWrapCls, paginationCls, thCls, tdCls, backLinkCls, PageHeader } from '@/components/ui/admin-form'

type Product = { id: number; name: string; pricing_type: string }

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', pricing_type: '' })
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [success, setSuccess] = useState('')
  const pageSize = 10

  function load() {
    fetch('/api/admin/products', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const sorted = [...res.data].sort(
            (a: Product, b: Product) => a.id - b.id
          )
          setItems(sorted)
          setPage(1)
        }
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.pricing_type.trim()) e.pricing_type = 'Pricing type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSuccess('')
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: form.name.trim(), pricing_type: form.pricing_type.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setForm({ name: '', pricing_type: '' })
        setErrors({})
        setSuccess('Product added successfully.')
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
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: editing.id, name: form.name.trim(), pricing_type: form.pricing_type.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setEditing(null)
        setForm({ name: '', pricing_type: '' })
        setErrors({})
        setSuccess('Product updated successfully.')
        load()
      } else {
        setErrors({ submit: data.error })
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this product?')) return
    setSuccess('')
    const res = await fetch('/api/admin/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSuccess('Product deleted successfully.')
      load()
    } else {
      alert((await res.json()).error)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredItems = normalizedSearch
    ? items.filter((row) => {
        const idText = String(row.id)
        return (
          idText.includes(normalizedSearch) ||
          row.name.toLowerCase().includes(normalizedSearch) ||
          row.pricing_type.toLowerCase().includes(normalizedSearch)
        )
      })
    : items

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const visibleItems = filteredItems.slice(startIndex, endIndex)

  return (
    <section className="w-full min-w-0 space-y-8">
      <Link href="/admin" className={backLinkCls}>← Dashboard</Link>
      <PageHeader
        title="Products"
        description="Define the SP Interior Solutions product types (blinds, shutters, screens) that appear on quotations."
      />

      <div className={`${cardCls} max-w-lg`}>
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Edit product</h3>
            <div className="space-y-2">
              <label className={labelCls}>Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls(!!errors.name)} required disabled={saving} />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Pricing type *</label>
              <input value={form.pricing_type} onChange={(e) => setForm((f) => ({ ...f, pricing_type: e.target.value }))} className={inputCls(!!errors.pricing_type)} required disabled={saving} />
              {errors.pricing_type && <p className="text-sm text-red-600">{errors.pricing_type}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" className={btnPrimary} disabled={saving}>Update</button>
              <button type="button" className={btnSecondary} onClick={() => { setEditing(null); setForm({ name: '', pricing_type: '' }); setErrors({}); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Add product</h3>
            <div className="space-y-2">
              <label className={labelCls}>Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls(!!errors.name)} required disabled={saving} />
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Pricing type *</label>
              <input value={form.pricing_type} onChange={(e) => setForm((f) => ({ ...f, pricing_type: e.target.value }))} className={inputCls(!!errors.pricing_type)} required disabled={saving} />
              {errors.pricing_type && <p className="text-sm text-red-600">{errors.pricing_type}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>Add product</button>
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
              placeholder="Search products…"
              className={`${inputCls(false)} max-w-xs`}
            />
          </div>
          <div className={tableWrapCls}>
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>ID</th>
                <th className={thCls}>Name</th>
                <th className={thCls}>Pricing type</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className={tdCls}>{row.id}</td>
                  <td className={tdCls}>{row.name}</td>
                  <td className={tdCls}>{row.pricing_type}</td>
                  <td className={tdCls + ' text-right'}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={btnSecondary + ' mr-0'}
                      onClick={() => {
                        setEditing(row)
                        setForm({ name: row.name, pricing_type: row.pricing_type })
                        setErrors({})
                      }}
                      >
                        Edit
                      </button>
                      <button type="button" className={btnDanger} onClick={() => handleDelete(row.id)}>
                        Delete
                      </button>
                    </div>
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
