import type { Customer, NewCustomer } from '../types/customer'
import type { BlindType, NewQuote, Quote, QuoteItem, NewQuoteItem } from '../types/quote'
import type { PricingResult } from '../types/pricing'
import * as customerRepository from '../repositories/customerRepository'
import * as quoteRepository from '../repositories/quoteRepository'
import * as quoteItemRepository from '../repositories/quoteItemRepository'
import { calculatePricing } from './pricingService'
import { generateQuoteNumber } from '../utils/generateQuoteNumber'
import { roundTo2 } from '../utils/rounding'
import { assertProductsAllowedForQuote } from '../products/offering'

/** Second GST (10%) on the whole quote total (sum of line amounts after base GST + costing rules); split across lines for storage. */
function allocateGstToLines(lineSubtotalsExGst: number[], quoteGst: number): number[] {
  const sum = lineSubtotalsExGst.reduce((a, b) => a + b, 0)
  if (sum <= 0 || lineSubtotalsExGst.length === 0) {
    return lineSubtotalsExGst.map(() => 0)
  }
  const out: number[] = []
  let allocated = 0
  for (let i = 0; i < lineSubtotalsExGst.length; i++) {
    if (i === lineSubtotalsExGst.length - 1) {
      out.push(roundTo2(quoteGst - allocated))
    } else {
      const g = roundTo2((quoteGst * lineSubtotalsExGst[i]) / sum)
      out.push(g)
      allocated = roundTo2(allocated + g)
    }
  }
  return out
}

export type CreateQuoteItemInput = {
  productId: number
  fabricGroupId: number
  inputWidth: number
  inputDrop: number
  quantity: number
  locationLabel: string
  locationOther?: string | null
  blindType?: BlindType
}

export type CreateQuoteInput = {
  customer: Pick<NewCustomer, 'name' | 'email' | 'phone' | 'address'>
  items: CreateQuoteItemInput[]
  additionalInfo: string
  etaText: string
  createdByUserId?: string | null
  /** Optional per-quote custom costing rules. When provided, used instead of costing_rules table for all lines. Not stored. */
  customCostingRules?: { ruleName: string; ruleType: string; value: number }[]
}

export type CreateQuoteResult = {
  quote: Quote
  customer: Customer
  items: { item: QuoteItem; pricing: PricingResult }[]
}

async function generateUniqueQuoteNumber(): Promise<string> {
  // Ensure the generated quote number is unique in the database.
  // Handles server restarts where the in-memory counter resets.
  for (let i = 0; i < 20; i += 1) {
    const candidate = generateQuoteNumber()
    const existing = await quoteRepository.findByQuoteNumber(candidate)
    if (!existing) return candidate
  }
  throw new Error('Unable to generate a unique quote number, please try again.')
}

export async function createQuote(
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  const {
    customer: customerInput,
    items,
    additionalInfo,
    etaText,
    createdByUserId,
    customCostingRules,
  } = input

  if (!customerInput.email || !customerInput.name) {
    throw new Error('Customer name and email are required')
  }
  if (!additionalInfo || !additionalInfo.trim()) {
    throw new Error('Additional information is required')
  }
  if (!etaText || !etaText.trim()) {
    throw new Error('ETA is required')
  }

  if (!items || items.length === 0) {
    throw new Error('At least one product line is required')
  }

  items.forEach((item, index) => {
    if (!item.productId || !item.fabricGroupId) {
      throw new Error(`Product and fabric group are required for line ${index + 1}`)
    }
    if (item.inputWidth <= 0 || item.inputDrop <= 0) {
      throw new Error(`Width and drop must be positive for line ${index + 1}`)
    }
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      throw new Error(`Quantity must be a whole number of at least 1 for line ${index + 1}`)
    }
  })

  await assertProductsAllowedForQuote(items.map((i) => i.productId))

  let customer = await customerRepository.findByEmail(customerInput.email)

  if (!customer) {
    customer = await customerRepository.create({
      name: customerInput.name,
      email: customerInput.email,
      phone: customerInput.phone ?? null,
      address: customerInput.address ?? null,
    })
  }

  const customRules =
    customCostingRules && customCostingRules.length > 0
      ? customCostingRules.map((r) => ({
          rule_name: r.ruleName,
          rule_type: r.ruleType,
          value: Number(r.value),
        }))
      : undefined

  const pricings: PricingResult[] = []
  for (const item of items) {
    const pricing = await calculatePricing({
      productId: item.productId,
      fabricGroupId: item.fabricGroupId,
      inputWidth: item.inputWidth,
      inputDrop: item.inputDrop,
      ...(customRules && { customRules }),
    })
    pricings.push(pricing)
  }

  // Bill GST: 10% on the sum of all line subtotals (unit line × quantity per item).
  const lineSubtotalsExGst = pricings.map((p, i) =>
    roundTo2(Number(p.subtotal) * items[i].quantity)
  )
  const quoteSubtotalExGst = roundTo2(lineSubtotalsExGst.reduce((a, b) => a + b, 0))
  const quoteGst = roundTo2(quoteSubtotalExGst * 0.1)
  const quoteFinal = roundTo2(quoteSubtotalExGst + quoteGst)
  const lineGst = allocateGstToLines(lineSubtotalsExGst, quoteGst)

  const pricingsWithGst: PricingResult[] = pricings.map((p, i) => ({
    ...p,
    subtotal: lineSubtotalsExGst[i],
    gst: lineGst[i],
    finalTotal: roundTo2(lineSubtotalsExGst[i] + lineGst[i]),
  }))

  const quoteNumber = await generateUniqueQuoteNumber()
  const firstItem = items[0]
  const firstPricing = pricingsWithGst[0]

  const newQuote: NewQuote = {
    quote_number: quoteNumber,
    customer_id: customer.id,
    // Header keeps first line details for backwards compatibility.
    product_id: firstItem.productId,
    fabric_group_id: firstItem.fabricGroupId,
    input_width: firstPricing.inputWidth,
    input_drop: firstPricing.inputDrop,
    rounded_width_id: firstPricing.roundedWidthId,
    rounded_drop_id: firstPricing.roundedDropId,
    base_price: firstPricing.basePrice,
    subtotal: quoteSubtotalExGst,
    gst: quoteGst,
    final_total: quoteFinal,
    // Initial status; POST /api/quotes updates to Sent (or EmailFailed) after sendQuoteEmail.
    status: 'Draft',
    created_by_user_id: createdByUserId ?? null,
    additional_info: additionalInfo.trim(),
    eta_text: etaText.trim(),
  }

  let quote: Quote
  try {
    quote = await quoteRepository.createQuote(newQuote)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message.toLowerCase() : ''
    // Backward-compatible fallback: allow quote creation on databases
    // where eta_text migration has not been applied yet.
    if (msg.includes('eta_text') && msg.includes('column')) {
      const legacyQuotePayload = { ...newQuote } as NewQuote & {
        eta_text?: string | null
      }
      delete legacyQuotePayload.eta_text
      quote = await quoteRepository.createQuote(legacyQuotePayload as NewQuote)
    } else {
      throw error
    }
  }

  const newItems: NewQuoteItem[] = items.map((item, index) => {
    const pricing = pricingsWithGst[index]
    return {
      quote_id: quote.id,
      product_id: item.productId,
      fabric_group_id: item.fabricGroupId,
      input_width: pricing.inputWidth,
      input_drop: pricing.inputDrop,
      rounded_width_id: pricing.roundedWidthId,
      rounded_drop_id: pricing.roundedDropId,
      base_price: pricing.basePrice,
      subtotal: pricing.subtotal,
      gst: pricing.gst,
      final_total: pricing.finalTotal,
      quantity: item.quantity,
      location_label: item.locationLabel,
      location_other: item.locationOther ?? null,
      blind_type: item.blindType === 'screen' ? 'screen' : 'blockout',
    }
  })

  const createdItems: QuoteItem[] = []
  for (const payload of newItems) {
    let created: QuoteItem
    try {
      created = await quoteItemRepository.create(payload)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message.toLowerCase() : ''
      if (msg.includes('blind_type') && msg.includes('column')) {
        const { blind_type: _omit, ...legacy } = payload as NewQuoteItem & { blind_type?: BlindType }
        created = await quoteItemRepository.create(legacy as NewQuoteItem)
      } else {
        throw error
      }
    }
    createdItems.push(created)
  }

  return {
    quote,
    customer,
    items: createdItems.map((item, index) => ({
      item,
      pricing: pricingsWithGst[index],
    })),
  }
}

