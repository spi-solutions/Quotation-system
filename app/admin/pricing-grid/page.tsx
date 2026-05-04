'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { inputCls, btnPrimary, btnSecondary, btnDanger, cardCls, labelCls, tableWrapCls, paginationCls, thCls, tdCls, backLinkCls, PageHeader } from '@/components/ui/admin-form'

type Row = { id: number; fabric_group_id: number; width_id: number; drop_id: number; base_price: number }
type Ref = { id: number; group_number?: number; width_value?: number; drop_value?: number }

export default function AdminPricingGridPage() {
  const [items, setItems] = useState<Row[]>([])
  const [fabricGroups, setFabricGroups] = useState<Ref[]>([])
  const [widths, setWidths] = useState<Ref[]>([])
  const [drops, setDrops] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ fabric_group_id: '', width_id: '', drop_id: '', base_price: '' })
  const [editing, setEditing] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [filterFabricGroupId, setFilterFabricGroupId] = useState('')
  const [filterWidthId, setFilterWidthId] = useState('')
  const [filterDropId, setFilterDropId] = useState('')
  const [filterBasePrice, setFilterBasePrice] = useState('')
  const [success, setSuccess] = useState('')
  const pageSize = 10

  function load() {
    Promise.all([
      fetch('/api/admin/pricing-grid', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/fabric-groups', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/widths', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/drops', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([grid, fg, w, d]) => {
      if (grid.data) {
        const sorted = [...grid.data].sort((a: Row, b: Row) => {
          if (a.fabric_group_id !== b.fabric_group_id) {
            return a.fabric_group_id - b.fabric_group_id
          }
          if (a.width_id !== b.width_id) {
            return a.width_id - b.width_id
          }
          if (a.drop_id !== b.drop_id) {
            return a.drop_id - b.drop_id
          }
          return a.id - b.id
        })
        setItems(sorted)
        setPage(1)
      }
      if (fg.data) setFabricGroups(fg.data)
      if (w.data) setWidths(w.data)
      if (d.data) setDrops(d.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.fabric_group_id) e.fabric_group_id = 'Select fabric group'
    if (!form.width_id) e.width_id = 'Select width'
    if (!form.drop_id) e.drop_id = 'Select drop'
    const bp = Number(form.base_price)
    if (form.base_price === '' || isNaN(bp) || bp < 0) e.base_price = 'Enter a valid base price (≥ 0)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSuccess('')
    try {
      const res = await fetch('/api/admin/pricing-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fabric_group_id: Number(form.fabric_group_id),
          width_id: Number(form.width_id),
          drop_id: Number(form.drop_id),
          base_price: Number(form.base_price),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setForm({ fabric_group_id: '', width_id: '', drop_id: '', base_price: '' })
        setErrors({})
        setSuccess('Pricing grid row added successfully.')
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
      const res = await fetch('/api/admin/pricing-grid', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editing.id,
          fabric_group_id: Number(form.fabric_group_id),
          width_id: Number(form.width_id),
          drop_id: Number(form.drop_id),
          base_price: Number(form.base_price),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setEditing(null)
        setForm({ fabric_group_id: '', width_id: '', drop_id: '', base_price: '' })
        setErrors({})
        setSuccess('Pricing grid row updated successfully.')
        load()
      } else {
        setErrors({ submit: data.error })
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this row?')) return
    const res = await fetch('/api/admin/pricing-grid', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSuccess('Pricing grid row deleted successfully.')
      load()
    } else {
      alert((await res.json()).error)
    }
  }

  const normalizedBasePrice = filterBasePrice.trim().toLowerCase()

  const filteredItems = items.filter((row) => {
    if (filterFabricGroupId && String(row.fabric_group_id) !== filterFabricGroupId) {
      return false
    }
    if (filterWidthId && String(row.width_id) !== filterWidthId) {
      return false
    }
    if (filterDropId && String(row.drop_id) !== filterDropId) {
      return false
    }
    if (normalizedBasePrice) {
      const priceText = String(row.base_price).toLowerCase()
      if (!priceText.includes(normalizedBasePrice)) {
        return false
      }
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const visibleItems = filteredItems.slice(startIndex, endIndex)

  return (
    <section className="w-full min-w-0 space-y-6">
      <Link href="/admin" className={backLinkCls}>← Dashboard</Link>
      <PageHeader
        title="Roller pricing grid"
        description="Maintain the base price matrix that links SP fabric groups, widths and drops to a starting price on each quotation."
      />

      <div className={`${cardCls} max-w-2xl`}>
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Edit row</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className={labelCls}>Fabric group *</label>
                <select value={form.fabric_group_id} onChange={(e) => setForm((f) => ({ ...f, fabric_group_id: e.target.value }))} className={inputCls(!!errors.fabric_group_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {fabricGroups.map((g) => <option key={g.id} value={g.id}>Group {(g as Ref & { group_number: number }).group_number}</option>)}
                </select>
                {errors.fabric_group_id && <p className="text-sm text-red-600">{errors.fabric_group_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Width *</label>
                <select value={form.width_id} onChange={(e) => setForm((f) => ({ ...f, width_id: e.target.value }))} className={inputCls(!!errors.width_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {widths.map((w) => <option key={w.id} value={w.id}>{(w as Ref & { width_value: number }).width_value}</option>)}
                </select>
                {errors.width_id && <p className="text-sm text-red-600">{errors.width_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Drop *</label>
                <select value={form.drop_id} onChange={(e) => setForm((f) => ({ ...f, drop_id: e.target.value }))} className={inputCls(!!errors.drop_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {drops.map((d) => <option key={d.id} value={d.id}>{(d as Ref & { drop_value: number }).drop_value}</option>)}
                </select>
                {errors.drop_id && <p className="text-sm text-red-600">{errors.drop_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Base price *</label>
                <input type="number" step="0.01" min={0} value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} className={inputCls(!!errors.base_price)} required disabled={saving} />
                {errors.base_price && <p className="text-sm text-red-600">{errors.base_price}</p>}
              </div>
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" className={btnPrimary} disabled={saving}>Update</button>
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Add row</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className={labelCls}>Fabric group *</label>
                <select value={form.fabric_group_id} onChange={(e) => setForm((f) => ({ ...f, fabric_group_id: e.target.value }))} className={inputCls(!!errors.fabric_group_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {fabricGroups.map((g) => <option key={g.id} value={g.id}>Group {(g as Ref & { group_number: number }).group_number}</option>)}
                </select>
                {errors.fabric_group_id && <p className="text-sm text-red-600">{errors.fabric_group_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Width *</label>
                <select value={form.width_id} onChange={(e) => setForm((f) => ({ ...f, width_id: e.target.value }))} className={inputCls(!!errors.width_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {widths.map((w) => <option key={w.id} value={w.id}>{(w as Ref & { width_value: number }).width_value}</option>)}
                </select>
                {errors.width_id && <p className="text-sm text-red-600">{errors.width_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Drop *</label>
                <select value={form.drop_id} onChange={(e) => setForm((f) => ({ ...f, drop_id: e.target.value }))} className={inputCls(!!errors.drop_id)} required disabled={saving}>
                  <option value="">Select</option>
                  {drops.map((d) => <option key={d.id} value={d.id}>{(d as Ref & { drop_value: number }).drop_value}</option>)}
                </select>
                {errors.drop_id && <p className="text-sm text-red-600">{errors.drop_id}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Base price *</label>
                <input type="number" step="0.01" min={0} value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} className={inputCls(!!errors.base_price)} required disabled={saving} />
                {errors.base_price && <p className="text-sm text-red-600">{errors.base_price}</p>}
              </div>
            </div>
            {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>Add row</button>
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fabric group
                </label>
                <select
                  value={filterFabricGroupId}
                  onChange={(e) => {
                    setFilterFabricGroupId(e.target.value)
                    setPage(1)
                  }}
                  className={`${inputCls(false)} w-32 text-xs`}
                >
                  <option value="">All</option>
                  {fabricGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Group {(g as Ref & { group_number: number }).group_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Width
                </label>
                <select
                  value={filterWidthId}
                  onChange={(e) => {
                    setFilterWidthId(e.target.value)
                    setPage(1)
                  }}
                  className={`${inputCls(false)} w-28 text-xs`}
                >
                  <option value="">All</option>
                  {widths.map((w) => (
                    <option key={w.id} value={w.id}>
                      {(w as Ref & { width_value: number }).width_value}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Drop
                </label>
                <select
                  value={filterDropId}
                  onChange={(e) => {
                    setFilterDropId(e.target.value)
                    setPage(1)
                  }}
                  className={`${inputCls(false)} w-28 text-xs`}
                >
                  <option value="">All</option>
                  {drops.map((d) => (
                    <option key={d.id} value={d.id}>
                      {(d as Ref & { drop_value: number }).drop_value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Base price
              </label>
              <input
                type="search"
                value={filterBasePrice}
                onChange={(e) => {
                  setFilterBasePrice(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. 42 or 42.00"
                className={`${inputCls(false)} w-40 text-xs`}
              />
            </div>
          </div>
          <div className={tableWrapCls}>
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>ID</th>
                <th className={thCls}>Fabric group</th>
                <th className={thCls}>Width</th>
                <th className={thCls}>Drop</th>
                <th className={thCls}>Base price</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className={tdCls}>{row.id}</td>
                  <td className={tdCls}>{row.fabric_group_id}</td>
                  <td className={tdCls}>{row.width_id}</td>
                  <td className={tdCls}>{row.drop_id}</td>
                  <td className={tdCls}>{Number(row.base_price).toFixed(2)}</td>
                  <td className={tdCls + ' text-right'}>
                    <button
                      type="button"
                      className={btnSecondary + ' mr-2'}
                      onClick={() => {
                        setEditing(row)
                        setForm({
                          fabric_group_id: String(row.fabric_group_id),
                          width_id: String(row.width_id),
                          drop_id: String(row.drop_id),
                          base_price: String(row.base_price),
                        })
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
