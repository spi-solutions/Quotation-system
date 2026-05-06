import { getXeroAccessToken } from '@/lib/xero/token'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'
import * as quoteItemRepository from '@/lib/repositories/quoteItemRepository'
import * as productRepository from '@/lib/repositories/productRepository'
import * as fabricGroupRepository from '@/lib/repositories/fabricGroupRepository'
import { roundTo2 } from '@/lib/utils/rounding'

const API = 'https://api.xero.com/api.xro/2.0'

/** Safe summary of Xero JSON error payloads for server logs (no tokens). */
function xeroApiErrorSummary(json: Record<string, unknown>, status: number): string {
  const elements = json?.Elements as unknown
  if (Array.isArray(elements) && elements[0]) {
    const el = elements[0] as { ValidationErrors?: Array<{ Message?: string }> }
    const v = el.ValidationErrors?.map((x) => x.Message).filter(Boolean)
    if (v?.length) return v.join('; ')
  }
  const msg = json.Message ?? json.Detail ?? json.Title
  if (typeof msg === 'string' && msg.trim()) return `${msg} (${status})`
  return `HTTP ${status}`
}

async function xeroFetch(
  accessToken: string,
  tenantId: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Find contact by email, or create one. Returns Xero ContactID. */
async function ensureXeroContact(
  accessToken: string,
  tenantId: string,
  customer: {
    name: string
    email: string
    phone: string | null
    address: string | null
    xero_contact_id?: string | null
  },
  logCtx: { quoteId: number; quoteNumber: string }
): Promise<string> {
  if (customer.xero_contact_id?.trim()) {
    const id = customer.xero_contact_id.trim()
    console.info('[xero] contact', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
      action: 'use_stored_contact_id',
      contactId: id,
    })
    return id
  }

  const email = customer.email.trim()
  const where = encodeURIComponent(`EmailAddress=="${email.replace(/"/g, '')}"`)
  const findRes = await xeroFetch(accessToken, tenantId, `/Contacts?where=${where}`)
  const findJson = (await findRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!findRes.ok) {
    console.warn('[xero] contact lookup HTTP error', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
      httpStatus: findRes.status,
      summary: xeroApiErrorSummary(findJson, findRes.status),
    })
  } else if (findJson?.Contacts && Array.isArray(findJson.Contacts) && findJson.Contacts.length > 0) {
    const id = (findJson.Contacts[0] as { ContactID: string }).ContactID
    console.info('[xero] contact', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
      action: 'found_by_email',
      contactId: id,
    })
    return id
  } else {
    console.info('[xero] contact', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
      action: 'not_found_will_create',
      emailDomain: email.includes('@') ? email.split('@')[1] : undefined,
    })
  }

  const createBody = {
    Contacts: [
      {
        Name: customer.name.trim() || email,
        EmailAddress: email,
        ...(customer.phone?.trim()
          ? {
              Phones: [
                {
                  PhoneType: 'DEFAULT',
                  PhoneNumber: customer.phone.trim(),
                },
              ],
            }
          : {}),
        ...(customer.address?.trim()
          ? {
              Addresses: [
                {
                  AddressType: 'STREET',
                  AddressLine1: customer.address.trim(),
                },
              ],
            }
          : {}),
      },
    ],
  }

  const createRes = await xeroFetch(accessToken, tenantId, '/Contacts', {
    method: 'POST',
    body: JSON.stringify(createBody),
  })
  const createJson = (await createRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!createRes.ok) {
    const summary = xeroApiErrorSummary(createJson, createRes.status)
    console.error('[xero] create contact failed', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
      httpStatus: createRes.status,
      summary,
    })
    const msg =
      (createJson?.Elements as any)?.[0]?.ValidationErrors?.[0]?.Message ||
      createJson?.Message ||
      createJson?.Detail ||
      `Create contact failed (${createRes.status})`
    throw new Error(String(msg))
  }
  const id = (createJson?.Contacts as any)?.[0]?.ContactID as string | undefined
  if (!id) {
    console.error('[xero] create contact: missing ContactID in response', {
      quoteId: logCtx.quoteId,
      quoteNumber: logCtx.quoteNumber,
    })
    throw new Error('Xero did not return ContactID')
  }
  console.info('[xero] contact', {
    quoteId: logCtx.quoteId,
    quoteNumber: logCtx.quoteNumber,
    action: 'created',
    contactId: id,
  })
  return id
}

/**
 * After a quote is approved: upsert Xero contact, create ACCREC invoice (DRAFT).
 * Skips if Xero env is incomplete or invoice already created.
 */
export async function syncApprovedQuoteToXero(quoteId: number): Promise<void> {
  console.info('[xero] sync start', { quoteId })

  let tokenResult: Awaited<ReturnType<typeof getXeroAccessToken>>
  try {
    tokenResult = await getXeroAccessToken()
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[xero] sync aborted: token refresh failed', { quoteId, error: err })
    await quoteRepository
      .updateXeroFields(quoteId, { xero_sync_error: `Token refresh failed: ${err}`.slice(0, 2000) })
      .catch(() => {})
    return
  }
  if (!tokenResult) {
    console.warn('[xero] sync skipped', {
      quoteId,
      reason: 'xero_env_incomplete',
      hint: 'see [xero] Token unavailable log for missing variable names',
    })
    await quoteRepository
      .updateXeroFields(quoteId, { xero_sync_error: 'Xero token/env unavailable' })
      .catch(() => {})
    return
  }

  const { accessToken, tenantId } = tokenResult

  const quote = await quoteRepository.findById(quoteId)
  if (!quote) {
    console.warn('[xero] sync skipped', { quoteId, reason: 'quote_not_found' })
    return
  }
  if (quote.status !== 'Approved') {
    console.info('[xero] sync skipped', {
      quoteId,
      quoteNumber: quote.quote_number,
      reason: 'status_not_approved',
      status: quote.status,
    })
    return
  }

  if (quote.xero_invoice_id?.trim()) {
    console.info('[xero] sync skipped', {
      quoteId,
      quoteNumber: quote.quote_number,
      reason: 'invoice_already_synced',
      xero_invoice_id: quote.xero_invoice_id.trim(),
    })
    return
  }

  await quoteRepository.updateXeroFields(quoteId, { xero_sync_error: null })

  const customer = await customerRepository.findById(quote.customer_id)
  if (!customer) {
    const msg = 'Customer not found'
    console.error('[xero] sync failed', { quoteId, quoteNumber: quote.quote_number, reason: msg })
    await quoteRepository.updateXeroFields(quoteId, {
      xero_sync_error: msg,
    })
    return
  }

  const accountCode = process.env.XERO_DEFAULT_ACCOUNT_CODE?.trim() || '200'
  const taxType = process.env.XERO_DEFAULT_TAX_TYPE?.trim() || 'OUTPUT'
  const lineAmountTypes = (process.env.XERO_LINE_AMOUNT_TYPES?.trim() || 'Inclusive') as
    | 'Inclusive'
    | 'Exclusive'
    | 'NoTax'

  const logCtx = { quoteId, quoteNumber: quote.quote_number }

  try {
    const contactId = await ensureXeroContact(
      accessToken,
      tenantId,
      {
        ...customer,
        xero_contact_id: customer.xero_contact_id,
      },
      logCtx
    )

    if (!customer.xero_contact_id?.trim()) {
      await customerRepository.updateById(customer.id, { xero_contact_id: contactId })
      console.info('[xero] customer updated with xero_contact_id', {
        ...logCtx,
        customerId: customer.id,
        contactId,
      })
    }

    const items = await quoteItemRepository.listByQuoteId(quoteId)
    const lineItems: Array<{
      Description: string
      Quantity: number
      UnitAmount: number
      AccountCode: string
      TaxType: string
    }> = []

    for (const item of items) {
      const product = await productRepository.findById(item.product_id)
      const fabric = await fabricGroupRepository.findById(item.fabric_group_id)
      const loc =
        item.location_label === 'Other' && item.location_other
          ? item.location_other
          : item.location_label
      const productName = product?.name ?? `Product #${item.product_id}`
      const fabricLabel = fabric ? `Fabric group ${fabric.group_number}` : 'Fabric'
      const description = `${productName} — ${fabricLabel} — ${loc} (${item.input_width}×${item.input_drop})`

      const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1)
      const lineTotal = Number(item.final_total)
      const unitAmount = roundTo2(lineTotal / qty)
      lineItems.push({
        Description: description,
        Quantity: qty,
        UnitAmount: unitAmount,
        AccountCode: accountCode,
        TaxType: taxType,
      })
    }

    if (lineItems.length === 0) {
      lineItems.push({
        Description: `Quote ${quote.quote_number}`,
        Quantity: 1,
        UnitAmount: Number(quote.final_total),
        AccountCode: accountCode,
        TaxType: taxType,
      })
    }

    const today = formatDate(new Date())
    const due = new Date()
    due.setDate(due.getDate() + 14)

    const invoiceBody = {
      Invoices: [
        {
          Type: 'ACCREC',
          Contact: { ContactID: contactId },
          Date: today,
          DueDate: formatDate(due),
          Reference: quote.quote_number,
          LineAmountTypes: lineAmountTypes,
          Status: 'DRAFT',
          LineItems: lineItems,
        },
      ],
    }

    console.info('[xero] creating draft invoice', {
      ...logCtx,
      customerId: customer.id,
      contactId,
      lineCount: lineItems.length,
      accountCode,
      taxType,
      lineAmountTypes,
      reference: quote.quote_number,
    })

    const invRes = await xeroFetch(accessToken, tenantId, '/Invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceBody),
    })
    const invJson = (await invRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!invRes.ok) {
      const summary = xeroApiErrorSummary(invJson, invRes.status)
      console.error('[xero] create invoice failed', {
        ...logCtx,
        httpStatus: invRes.status,
        summary,
      })
      const detail = String(invJson?.Detail ?? invJson?.Title ?? '')
      const msg =
        (invJson?.Elements as any)?.[0]?.ValidationErrors?.[0]?.Message ||
        invJson?.Message ||
        invJson?.Detail ||
        `Create invoice failed (${invRes.status})`
      const unauthorized =
        invRes.status === 401 ||
        invRes.status === 403 ||
        /authorization/i.test(String(msg)) ||
        /authorization/i.test(detail) ||
        /authorization/i.test(summary)
      const hint = unauthorized
        ? ' Reconnect Xero with offline_access + accounting.contacts + accounting.transactions (enabled on the Xero app).'
        : ''
      throw new Error(String(msg) + hint)
    }

    const invoiceId = (invJson?.Invoices as any)?.[0]?.InvoiceID as string | undefined
    if (!invoiceId) {
      console.error('[xero] create invoice: missing InvoiceID in response', logCtx)
      throw new Error('Xero did not return InvoiceID')
    }

    await quoteRepository.updateXeroFields(quoteId, {
      xero_invoice_id: invoiceId,
      xero_sync_error: null,
    })

    console.info('[xero] sync completed', {
      ...logCtx,
      xero_invoice_id: invoiceId,
      contactId,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[xero] sync failed', {
      quoteId,
      quoteNumber: quote.quote_number,
      error: msg,
      ...(stack ? { stack } : {}),
    })
    await quoteRepository.updateXeroFields(quoteId, {
      xero_sync_error: msg.slice(0, 2000),
    })
  }
}
