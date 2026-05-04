'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import {
  PageHeader,
  PageCard,
  SectionTitle,
  inputCls,
  btnPrimary,
  btnSecondary,
  errorCls,
  labelCls,
  backLinkCls,
  thCls,
  tdCls,
  tableWrapCls,
} from '@/components/ui/design-system'

type Product = { id: number; name: string; pricing_type: string }
type FabricGroup = { id: number; group_number: number }

type LineItem = {
  id: number
  productId: string
  fabricGroupId: string
  inputWidth: string
  inputDrop: string
  quantity: string
  location: string
  locationOther: string
}

type PreparedItem = {
  productId: string
  fabricGroupId: string
  inputWidth: string
  inputDrop: string
  quantity: string
  location: string
  locationOther: string
}

type PreparedCustomRule = {
  ruleName: string
  ruleType: string
  value: number
}

type QuotePreviewData = {
  customer: {
    name: string
    email: string
    phone: string | null
    address: string | null
  }
  additionalInfo: string
  etaText: string
  items: PreparedItem[]
  customCostingRules?: PreparedCustomRule[]
}

type QuotePricingPreview = {
  lines: {
    lineNumber: number
    quantity: number
    subtotal: number
    gst: number
    finalTotal: number
  }[]
  subtotal: number
  gst: number
  finalTotal: number
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_CODES = ['+61', '+91', '+1', '+64'] as const

function splitPhoneWithCode(phone: string | null | undefined): {
  phoneCode: string
  phone: string
} {
  const raw = String(phone || '').trim()
  if (!raw) return { phoneCode: '+61', phone: '' }
  const match = raw.match(/^(\+\d{1,3})\s*(.*)$/)
  if (match) return { phoneCode: match[1], phone: match[2] || '' }
  return { phoneCode: '+61', phone: raw }
}

function combinePhoneWithCode(phoneCode: string, phone: string): string | null {
  const value = phone.trim()
  if (!value) return null
  if (value.startsWith('+')) return value
  return `${phoneCode} ${value}`.trim()
}

export default function AdminNewQuotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromQuoteId = searchParams.get('from')
  const [products, setProducts] = useState<Product[]>([])
  const [fabricGroups, setFabricGroups] = useState<FabricGroup[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingFromQuote, setLoadingFromQuote] = useState(!!fromQuoteId)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    customer: { name: '', email: '', phoneCode: '+61', phone: '', address: '' },
    productId: '',
    fabricGroupId: '',
    inputWidth: '',
    inputDrop: '',
    quantity: '1',
    additionalInfo: '',
    etaText: 'Blinds 2-3 wks',
    location: '',
    locationOther: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [itemError, setItemError] = useState<string>('')
  const [customerOptions, setCustomerOptions] = useState<
    { id: number; name: string; email: string; phone: string | null; address: string | null }[]
  >([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [customCostingOpen, setCustomCostingOpen] = useState(false)
  const [customCostingRules, setCustomCostingRules] = useState<
    { id: number; ruleName: string; ruleType: string; value: string }[]
  >([])
  const [previewData, setPreviewData] = useState<QuotePreviewData | null>(null)
  const [previewPricing, setPreviewPricing] = useState<QuotePricingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  /** Unique rule options for dropdown: from costing_rules table, or defaults if empty */
  const [costingRuleOptions, setCostingRuleOptions] = useState<
    { ruleName: string; ruleType: string }[]
  >([
    { ruleName: 'GST', ruleType: 'percentage' },
    { ruleName: 'Rental/Hire', ruleType: 'fixed' },
    { ruleName: 'Delivery', ruleType: 'fixed' },
    { ruleName: 'Installation', ruleType: 'fixed' },
  ])

  useEffect(() => {
    Promise.all([
      fetch('/api/products', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/fabric-groups', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/customers', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/costing-rules', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([pRes, fRes, cRes, rulesRes]) => {
        if (pRes.data) setProducts(pRes.data)
        if (fRes.data) setFabricGroups(fRes.data)
        if (Array.isArray(cRes.data)) {
          setCustomerOptions(cRes.data)
        }
        if (Array.isArray(rulesRes.data) && rulesRes.data.length > 0) {
          const seen = new Set<string>()
          const options: { ruleName: string; ruleType: string }[] = []
          for (const r of rulesRes.data as { rule_name: string; rule_type: string }[]) {
            const key = `${r.rule_name}|${r.rule_type}`
            if (!seen.has(key)) {
              seen.add(key)
              options.push({ ruleName: r.rule_name, ruleType: r.rule_type })
            }
          }
          if (options.length > 0) setCostingRuleOptions(options)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingOptions(false))
  }, [])

  useEffect(() => {
    if (!fromQuoteId) return
    const id = Number(fromQuoteId)
    if (!Number.isFinite(id)) {
      setLoadingFromQuote(false)
      return
    }
    fetch(`/api/quotes/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        const quote = res.data
        if (!quote) {
          setLoadingFromQuote(false)
          return
        }
        const customer = quote.customer
        if (customer) {
          const parsedPhone = splitPhoneWithCode(customer.phone)
          setForm((f) => ({
            ...f,
            customer: {
              name: customer.name ?? '',
              email: customer.email ?? '',
              phoneCode: parsedPhone.phoneCode,
              phone: parsedPhone.phone,
              address: customer.address ?? '',
            },
            additionalInfo: quote.additional_info ?? '',
            etaText: quote.eta_text ?? 'Blinds 2-3 wks',
          }))
          setCustomerSearch(customer.name ?? '')
        } else {
          setForm((f) => ({
            ...f,
            additionalInfo: quote.additional_info ?? '',
            etaText: quote.eta_text ?? 'Blinds 2-3 wks',
          }))
        }
        const items = quote.items
        if (Array.isArray(items) && items.length > 0) {
          setLineItems(
            items.map((item: { id?: number; product_id: number; fabric_group_id: number; input_width: number; input_drop: number; quantity?: number; location_label: string; location_other: string | null }, idx: number) => ({
              id: item.id ?? idx + 1,
              productId: String(item.product_id),
              fabricGroupId: String(item.fabric_group_id),
              inputWidth: String(item.input_width),
              inputDrop: String(item.input_drop),
              quantity: String(item.quantity != null && item.quantity >= 1 ? item.quantity : 1),
              location: item.location_label ?? 'Other',
              locationOther: item.location_other ?? '',
            }))
          )
        } else {
          setLineItems([
            {
              id: 1,
              productId: String(quote.product_id),
              fabricGroupId: String(quote.fabric_group_id),
              inputWidth: String(quote.input_width),
              inputDrop: String(quote.input_drop),
              quantity: '1',
              location: 'Other',
              locationOther: '',
            },
          ])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFromQuote(false))
  }, [fromQuoteId])

  function validateCustomer(): boolean {
    const e: Record<string, string> = {}
    if (!form.customer.name.trim()) e.customerName = 'Customer name is required'
    if (!form.customer.email.trim()) e.customerEmail = 'Customer email is required'
    else if (!emailRe.test(form.customer.email.trim())) e.customerEmail = 'Enter a valid email'
    if (!form.additionalInfo.trim()) e.additionalInfo = 'Additional information is required'
    if (!form.etaText.trim()) e.etaText = 'ETA is required'
    setErrors((prev) => ({ ...prev, ...e }))
    return Object.keys(e).length === 0
  }

  function handleCustomerNameChange(value: string) {
    const trimmed = value
    setForm((f) => ({
      ...f,
      customer: { ...f.customer, name: trimmed },
    }))
    setErrors((prev) => ({ ...prev, customerName: undefined }))
    setCustomerSearch(trimmed)

    const searchTerm = trimmed.trim().toLowerCase()
    if (searchTerm.length < 3 || !customerOptions.length) {
      setCustomerDropdownOpen(false)
      return
    }
    setCustomerDropdownOpen(true)
  }

  function handleSelectCustomer(option: {
    id: number
    name: string
    email: string
    phone: string | null
    address: string | null
  }) {
    const parsedPhone = splitPhoneWithCode(option.phone)
    setForm((f) => ({
      ...f,
      customer: {
        name: option.name,
        email: option.email,
        phoneCode: parsedPhone.phoneCode,
        phone: parsedPhone.phone,
        address: option.address ?? '',
      },
    }))
    setCustomerSearch(option.name)
    setCustomerDropdownOpen(false)
    setPreviewData(null)
    setPreviewPricing(null)
  }

  function validateCurrentItem(): boolean {
    const e: Record<string, string> = {}
    if (!form.productId) e.productId = 'Select a product'
    if (!form.fabricGroupId) e.fabricGroupId = 'Select a fabric group'
    const w = Number(form.inputWidth)
    const d = Number(form.inputDrop)
    if (!form.inputWidth || isNaN(w) || w < 1) e.inputWidth = 'Enter a valid width (≥ 1)'
    if (!form.inputDrop || isNaN(d) || d < 1) e.inputDrop = 'Enter a valid drop (≥ 1)'
    const qty = Number(form.quantity)
    if (!form.quantity.trim() || !Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      e.quantity = 'Enter a whole number quantity (≥ 1)'
    }
    if (!form.location) e.location = 'Select a location'
    if (form.location === 'Other' && !form.locationOther.trim()) {
      e.locationOther = 'Specify the other location'
    }
    setErrors((prev) => ({ ...prev, ...e }))
    setItemError(Object.keys(e).length ? 'Fix the line details before adding.' : '')
    return Object.keys(e).length === 0
  }

  function resetItemForm() {
    setForm((f) => ({
      ...f,
      productId: '',
      fabricGroupId: '',
      inputWidth: '',
      inputDrop: '',
      quantity: '1',
      location: '',
      locationOther: '',
    }))
    setEditingItemId(null)
    setItemError('')
  }

  function handleAddOrUpdateItem(e: React.MouseEvent) {
    e.preventDefault()
    if (!validateCurrentItem()) return

    if (editingItemId != null) {
      setLineItems((items) =>
        items.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                productId: form.productId,
                fabricGroupId: form.fabricGroupId,
                inputWidth: form.inputWidth,
                inputDrop: form.inputDrop,
                quantity: form.quantity,
                location: form.location,
                locationOther: form.locationOther,
              }
            : item
        )
      )
    } else {
      const nextId = lineItems.length ? Math.max(...lineItems.map((i) => i.id)) + 1 : 1
      setLineItems((items) => [
        ...items,
        {
          id: nextId,
          productId: form.productId,
          fabricGroupId: form.fabricGroupId,
          inputWidth: form.inputWidth,
          inputDrop: form.inputDrop,
          quantity: form.quantity,
          location: form.location,
          locationOther: form.locationOther,
        },
      ])
    }
    resetItemForm()
  }

  function handleEditItem(item: LineItem) {
    setEditingItemId(item.id)
    setForm((f) => ({
      ...f,
      productId: item.productId,
      fabricGroupId: item.fabricGroupId,
      inputWidth: item.inputWidth,
      inputDrop: item.inputDrop,
      quantity: item.quantity,
      location: item.location,
      locationOther: item.locationOther,
    }))
    setItemError('')
    setPreviewData(null)
    setPreviewPricing(null)
  }

  function handleDeleteItem(id: number) {
    setLineItems((items) => items.filter((i) => i.id !== id))
    if (editingItemId === id) {
      resetItemForm()
    }
    setPreviewData(null)
    setPreviewPricing(null)
  }

  function prepareQuotePayload(): QuotePreviewData | null {
    setErrors({})
    setItemError('')

    const okCustomer = validateCustomer()
    if (!okCustomer) return

    let itemsToSend: {
      productId: string
      fabricGroupId: string
      inputWidth: string
      inputDrop: string
      quantity: string
      location: string
      locationOther: string
    }[]
    if (lineItems.length === 0) {
      // If there are no line items yet but the user filled the current row, try to use it.
      if (!validateCurrentItem()) {
        setItemError('Add at least one product line to create quotations.')
        return
      }
      itemsToSend = [
        {
          productId: form.productId,
          fabricGroupId: form.fabricGroupId,
          inputWidth: form.inputWidth,
          inputDrop: form.inputDrop,
          quantity: form.quantity,
          location: form.location,
          locationOther: form.locationOther,
        },
      ]
      setLineItems([
        {
          id: 1,
          productId: form.productId,
          fabricGroupId: form.fabricGroupId,
          inputWidth: form.inputWidth,
          inputDrop: form.inputDrop,
          quantity: form.quantity,
          location: form.location,
          locationOther: form.locationOther,
        },
      ])
    } else {
      itemsToSend = lineItems.map((item) => ({
        productId: item.productId,
        fabricGroupId: item.fabricGroupId,
        inputWidth: item.inputWidth,
        inputDrop: item.inputDrop,
        quantity: item.quantity,
        location: item.location,
        locationOther: item.locationOther,
      }))
    }

    const customRulesPayload =
      customCostingRules.length > 0
        ? customCostingRules
            .filter(
              (r) =>
                r.ruleName.trim() !== '' &&
                (r.ruleType === 'percentage' || r.ruleType === 'fixed') &&
                !Number.isNaN(Number(r.value))
            )
            .map((r) => ({
              ruleName: r.ruleName.trim(),
              ruleType: r.ruleType,
              value: Number(r.value),
            }))
        : undefined

    return {
      customer: {
        name: form.customer.name.trim(),
        email: form.customer.email.trim(),
        phone: combinePhoneWithCode(form.customer.phoneCode, form.customer.phone),
        address: form.customer.address.trim() || null,
      },
      additionalInfo: form.additionalInfo,
      etaText: form.etaText,
      items: itemsToSend,
      ...(customRulesPayload &&
        customRulesPayload.length > 0 && { customCostingRules: customRulesPayload }),
    }
  }

  async function handlePreviewQuote(e: React.MouseEvent) {
    e.preventDefault()
    const prepared = prepareQuotePayload()
    if (!prepared) return
    setPreviewLoading(true)
    setErrors((prev) => ({ ...prev, submit: undefined }))
    try {
      const res = await fetch('/api/quotes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: prepared.items,
          ...(prepared.customCostingRules &&
            prepared.customCostingRules.length > 0 && {
              customCostingRules: prepared.customCostingRules,
            }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, submit: data.error || 'Failed to preview pricing' }))
        setPreviewData(null)
        setPreviewPricing(null)
        setPreviewLoading(false)
        return
      }
      setPreviewData(prepared)
      setPreviewPricing(data.data ?? null)
    } catch {
      setErrors((prev) => ({ ...prev, submit: 'Failed to preview pricing' }))
      setPreviewData(null)
      setPreviewPricing(null)
    }
    setPreviewLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const prepared = prepareQuotePayload()
    if (!prepared) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer: prepared.customer,
          additionalInfo: prepared.additionalInfo,
          etaText: prepared.etaText,
          items: prepared.items.map((item) => ({
            productId: item.productId,
            fabricGroupId: item.fabricGroupId,
            inputWidth: item.inputWidth,
            inputDrop: item.inputDrop,
            quantity: Number(item.quantity),
            locationLabel: item.location,
            locationOther: item.location === 'Other' ? item.locationOther : null,
          })),
          ...(prepared.customCostingRules &&
            prepared.customCostingRules.length > 0 && {
              customCostingRules: prepared.customCostingRules,
            }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors({ submit: data.error || 'Failed to create quote' })
        setSubmitting(false)
        return
      }
      if (data.emailSent === false && data.emailError) {
        try {
          sessionStorage.setItem(
            'qg_quote_email_notice',
            `Quote created, but the email was not sent: ${data.emailError}`
          )
        } catch {
          /* ignore */
        }
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setErrors({ submit: 'Failed to create quote(s)' })
    }
    setSubmitting(false)
  }

  return (
    <section className="w-full min-w-0 max-w-5xl space-y-8">
      <Link href="/admin" className={backLinkCls}>← Dashboard</Link>
      <PageHeader
        title={fromQuoteId ? 'Create new version' : 'Generate quotation'}
        description={fromQuoteId ? 'Edit the details below and save to create a new quote with a new quote number. The original quote is unchanged.' : 'Create one or more quotations for a customer. Each product line below becomes its own quotation and PDF.'}
      />

      {loadingFromQuote ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">Loading quote…</p>
        </div>
      ) : (
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)]">
        <PageCard>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <SectionTitle>Customer</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2 relative">
                  <label className={labelCls}>Name *</label>
                  <input
                    value={form.customer.name}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    className={inputCls(!!errors.customerName)}
                    placeholder="Start typing to search existing customers…"
                    disabled={submitting || loadingOptions}
                    onFocus={() => {
                      const term = form.customer.name.trim()
                      if (customerOptions.length && term.length >= 3) {
                        setCustomerDropdownOpen(true)
                      }
                    }}
                    onBlur={() => {
                      // small delay so click on option can register
                      setTimeout(() => setCustomerDropdownOpen(false), 150)
                    }}
                  />
                  {errors.customerName && (
                    <p className={errorCls}>{errors.customerName}</p>
                  )}
                  {customerDropdownOpen && customerOptions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {customerOptions
                        .filter((c) =>
                          customerSearch.trim().length >= 3
                            ? c.name.toLowerCase().includes(customerSearch.trim().toLowerCase())
                            : false
                        )
                        .slice(0, 10)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectCustomer(c)
                            }}
                            className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-purple-50"
                          >
                            <span className="font-medium text-slate-800">{c.name}</span>
                            <span className="text-xs text-slate-500">
                              {c.email}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input
                    type="email"
                    value={form.customer.email}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customer: { ...f.customer, email: e.target.value },
                      }))}
                    className={inputCls(!!errors.customerEmail)}
                    placeholder="email@example.com"
                    disabled={submitting}
                  />
                  {errors.customerEmail && (
                    <p className={errorCls}>{errors.customerEmail}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Phone</label>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <select
                      value={form.customer.phoneCode}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          customer: { ...f.customer, phoneCode: e.target.value },
                        }))}
                      className={inputCls(false)}
                      disabled={submitting}
                    >
                      {PHONE_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={form.customer.phone}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          customer: { ...f.customer, phone: e.target.value },
                        }))}
                      className={inputCls(false) + ' min-w-0'}
                      placeholder="Phone number"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input
                    value={form.customer.address}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customer: { ...f.customer, address: e.target.value },
                      }))}
                    className={inputCls(false)}
                    placeholder="Address"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => setCustomCostingOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={submitting}
              >
                <span>Custom costing (optional)</span>
                {customCostingOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                )}
              </button>
              {customCostingOpen && (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">
                    Override default costing rules for this quote. Select a rule and enter the value. Only these custom rules are applied (table rules are not used). Leave empty to use the default rules from the costing table.
                  </p>
                  {customCostingRules.map((rule) => {
                    const optionKey = `${rule.ruleName}|${rule.ruleType}`
                    return (
                      <div
                        key={rule.id}
                        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                      >
                        <div className="min-w-0 flex-1 sm:min-w-[200px]">
                          <label className={labelCls}>Rule</label>
                          <select
                            value={optionKey}
                            onChange={(e) => {
                              const v = e.target.value
                              const [ruleName, ruleType] = v.split('|')
                              setCustomCostingRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id ? { ...r, ruleName, ruleType } : r
                                )
                              )
                            }}
                            className={inputCls(false)}
                            disabled={submitting}
                          >
                            {costingRuleOptions.map((opt) => (
                              <option
                                key={`${opt.ruleName}|${opt.ruleType}`}
                                value={`${opt.ruleName}|${opt.ruleType}`}
                              >
                                {opt.ruleName} ({opt.ruleType === 'percentage' ? 'Percentage' : 'Fixed'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-28">
                          <label className={labelCls}>Value</label>
                          <input
                            type="number"
                            step={rule.ruleType === 'percentage' ? 0.01 : 1}
                            min={0}
                            value={rule.value}
                            onChange={(e) =>
                              setCustomCostingRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id ? { ...r, value: e.target.value } : r
                                )
                              )
                            }
                            className={inputCls(false)}
                            placeholder={rule.ruleType === 'percentage' ? '10' : '25'}
                            disabled={submitting}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomCostingRules((prev) => prev.filter((r) => r.id !== rule.id))
                          }
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                          disabled={submitting}
                        >
                          <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const first = costingRuleOptions[0]
                      setCustomCostingRules((prev) => [
                        ...prev,
                        {
                          id: prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1,
                          ruleName: first?.ruleName ?? 'Installation',
                          ruleType: first?.ruleType ?? 'fixed',
                          value: '',
                        },
                      ])
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-purple-300 hover:text-purple-700 disabled:opacity-60"
                    disabled={submitting}
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Add rule
                  </button>
                </div>
              )}
            </div>

            <div>
              <SectionTitle>Quote details</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Product *</label>
                  <select
                    value={form.productId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, productId: e.target.value }))}
                    className={inputCls(!!errors.productId)}
                    disabled={submitting || loadingOptions}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.productId && (
                    <p className={errorCls}>{errors.productId}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Fabric group *</label>
                  <select
                    value={form.fabricGroupId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fabricGroupId: e.target.value }))}
                    className={inputCls(!!errors.fabricGroupId)}
                    disabled={submitting || loadingOptions}
                  >
                    <option value="">Select fabric group</option>
                    {fabricGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        Group {g.group_number}
                      </option>
                    ))}
                  </select>
                  {errors.fabricGroupId && (
                    <p className={errorCls}>{errors.fabricGroupId}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Width *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.inputWidth}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, inputWidth: e.target.value }))}
                    className={inputCls(!!errors.inputWidth)}
                    placeholder="Width"
                    disabled={submitting}
                  />
                  {errors.inputWidth && (
                    <p className={errorCls}>{errors.inputWidth}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Drop *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.inputDrop}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, inputDrop: e.target.value }))}
                    className={inputCls(!!errors.inputDrop)}
                    placeholder="Drop"
                    disabled={submitting}
                  />
                  {errors.inputDrop && (
                    <p className={errorCls}>{errors.inputDrop}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.quantity}
                    onChange={(e) => {
                      setErrors((prev) => ({ ...prev, quantity: undefined }))
                      setForm((f) => ({
                        ...f,
                        quantity: e.target.value,
                      }))
                    }}
                    className={inputCls(!!errors.quantity)}
                    placeholder="1"
                    disabled={submitting}
                  />
                  {errors.quantity && (
                    <p className={errorCls}>{errors.quantity}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Location *</label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
                    <select
                      value={form.location}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          location: e.target.value,
                          locationOther: e.target.value === 'Other' ? f.locationOther : '',
                        }))}
                      className={inputCls(!!errors.location)}
                      disabled={submitting}
                    >
                      <option value="">Select location</option>
                      <option value="Hall window">Hall window</option>
                      <option value="Bedroom window">Bedroom window</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      type="text"
                      value={form.locationOther}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          locationOther: e.target.value,
                        }))}
                      className={inputCls(!!errors.locationOther)}
                      placeholder="If 'Other', specify (e.g. Kitchen window)"
                      disabled={submitting || form.location !== 'Other'}
                    />
                  </div>
                  {errors.location && <p className={errorCls}>{errors.location}</p>}
                  {errors.locationOther && <p className={errorCls}>{errors.locationOther}</p>}
                </div>
              </div>

              <div className="mt-6">
                <SectionTitle>Additional information</SectionTitle>
                <p className="mb-2 text-xs text-slate-500">
                  This text will appear in the &quot;Additional information&quot; box on the quotation PDF.
                </p>
                <textarea
                  value={form.additionalInfo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      additionalInfo: e.target.value,
                    }))}
                  rows={4}
                  className={inputCls(!!errors.additionalInfo) + ' resize-y'}
                  disabled={submitting}
                />
                {errors.additionalInfo && (
                  <p className={errorCls}>{errors.additionalInfo}</p>
                )}
              </div>
              <div className="mt-4">
                <label className={labelCls}>ETA *</label>
                <p className="mb-2 text-xs text-slate-500">
                  This value appears as the ETA line in the PDF terms section.
                </p>
                <input
                  value={form.etaText}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      etaText: e.target.value,
                    }))}
                  className={inputCls(!!errors.etaText)}
                  placeholder="e.g. Blinds 2-3 wks"
                  disabled={submitting}
                />
                {errors.etaText && <p className={errorCls}>{errors.etaText}</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 transition hover:border-purple-300 hover:bg-purple-100 disabled:opacity-60"
                  disabled={submitting || loadingOptions}
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  {editingItemId != null ? 'Update product' : 'Add product'}
                </button>
                {itemError && (
                  <p className="text-xs text-red-600">{itemError}</p>
                )}
              </div>

              {lineItems.length > 0 && (
                <div className="mt-6">
                  <div className={tableWrapCls}>
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thCls}>#</th>
                          <th className={thCls}>Product</th>
                          <th className={thCls}>Fabric group</th>
                          <th className={thCls}>Width</th>
                          <th className={thCls}>Drop</th>
                          <th className={thCls}>Qty</th>
                          <th className={thCls}>Location</th>
                          <th className={thCls + ' text-right'}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, index) => {
                          const product = products.find((p) => String(p.id) === item.productId)
                          const fabric = fabricGroups.find((g) => String(g.id) === item.fabricGroupId)
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className={tdCls}>{index + 1}</td>
                              <td className={tdCls}>{product?.name ?? '—'}</td>
                              <td className={tdCls}>
                                {fabric ? `Group ${fabric.group_number}` : '—'}
                              </td>
                              <td className={tdCls}>{item.inputWidth}</td>
                              <td className={tdCls}>{item.inputDrop}</td>
                              <td className={tdCls}>{item.quantity}</td>
                              <td className={tdCls}>
                                {item.location === 'Other'
                                  ? item.locationOther || 'Other'
                                  : item.location || '—'}
                              </td>
                              <td className={tdCls + ' text-right'}>
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItem(item)}
                                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-purple-300 hover:text-purple-700"
                                  >
                                    <Pencil className="mr-1 h-3 w-3" aria-hidden="true" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="inline-flex items-center rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Each line above will become a line item on the quotation PDF, using the selected location.
                  </p>
                </div>
              )}
            </div>

            {errors.submit && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {errors.submit}
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <button
                type="button"
                className={btnSecondary}
                onClick={handlePreviewQuote}
                disabled={submitting || loadingOptions || previewLoading}
              >
                {previewLoading ? 'Reviewing…' : 'Review quote'}
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={submitting || loadingOptions || previewLoading || !previewData || !previewPricing}
              >
                {submitting ? 'Creating…' : 'Confirm & send quote'}
              </button>
              <Link href="/admin" className={btnSecondary}>
                Cancel
              </Link>
            </div>
            {!previewData && (
              <p className="text-xs text-slate-500">
                Click <strong>Review quote</strong> first, then confirm to send.
              </p>
            )}
            {previewData && previewPricing && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-purple-700">
                  Ready to send
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  Please confirm these details
                </h3>
                <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-slate-900">Customer:</span>{' '}
                    {previewData.customer.name}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Email:</span>{' '}
                    {previewData.customer.email}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Phone:</span>{' '}
                    {previewData.customer.phone || '—'}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Address:</span>{' '}
                    {previewData.customer.address || '—'}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-900">Additional info:</span>{' '}
                    {previewData.additionalInfo}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-900">ETA:</span>{' '}
                    {previewData.etaText}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-900">Lines to include:</span>{' '}
                    {previewData.items.length}
                  </p>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-purple-100 bg-white">
                  <table className="min-w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr>
                        <th className={thCls}>#</th>
                        <th className={thCls}>Qty</th>
                        <th className={thCls}>Location</th>
                        <th className={thCls}>Product</th>
                        <th className={thCls}>Fabric</th>
                        <th className={thCls + ' text-right'}>Subtotal</th>
                        <th className={thCls + ' text-right'}>GST</th>
                        <th className={thCls + ' text-right'}>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPricing.lines.map((line, idx) => {
                        const item = previewData.items[idx]
                        const product = products.find((p) => String(p.id) === item?.productId)
                        const fabric = fabricGroups.find((g) => String(g.id) === item?.fabricGroupId)
                        return (
                          <tr key={line.lineNumber}>
                            <td className={tdCls}>{line.lineNumber}</td>
                            <td className={tdCls}>{line.quantity}</td>
                            <td className={tdCls}>
                              {item?.location === 'Other'
                                ? item.locationOther || 'Other'
                                : item?.location || '—'}
                            </td>
                            <td className={tdCls}>{product?.name ?? '—'}</td>
                            <td className={tdCls}>{fabric ? `Group ${fabric.group_number}` : '—'}</td>
                            <td className={tdCls + ' text-right'}>{line.subtotal.toFixed(2)}</td>
                            <td className={tdCls + ' text-right'}>{line.gst.toFixed(2)}</td>
                            <td className={tdCls + ' text-right font-semibold'}>{line.finalTotal.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-slate-700 sm:justify-end">
                  <p>
                    <span className="font-medium text-slate-900">Subtotal (ex GST): </span>
                    {previewPricing.subtotal.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">GST 10%: </span>
                    {previewPricing.gst.toFixed(2)}
                  </p>
                  <p className="text-base">
                    <span className="font-semibold text-slate-900">Total payable: </span>
                    <span className="font-semibold text-slate-900">
                      {previewPricing.finalTotal.toFixed(2)}
                    </span>
                  </p>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  If you edit anything above, click <strong>Review quote</strong> again before confirming.
                </p>
              </div>
            )}
          </form>
        </PageCard>

        <PageCard className="hidden space-y-5 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
            Customer flow
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Quote is sent to the customer by email
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            After you create the quote, the customer receives it by email. They can view it in &quot;My quotations&quot; on their dashboard, download the PDF, and accept the quote when ready.
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Use the customer&apos;s email so they can see the quote in their account.</li>
            <li>Once email is integrated, the same PDF will be sent automatically.</li>
            <li>Customer can accept the quote from the dashboard or from the email link.</li>
          </ul>
        </PageCard>
      </div>
      )}
    </section>
  )
}
