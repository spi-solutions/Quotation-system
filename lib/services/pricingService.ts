import type { CostingRuleBreakdownLine, PricingResult } from '../types/pricing'
import * as widthRepository from '../repositories/widthRepository'
import * as dropRepository from '../repositories/dropRepository'
import * as pricingGridRepository from '../repositories/pricingGridRepository'
import * as costingRuleRepository from '../repositories/costingRuleRepository'
import { roundTo2 } from '../utils/rounding'

export type PricingInput = {
  productId: number
  fabricGroupId: number
  inputWidth: number
  inputDrop: number
  /** When provided, override only these rules' values; all other rules come from costing_rules table. */
  customRules?: { rule_name: string; rule_type: string; value: number }[]
}

export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  const { productId, fabricGroupId, inputWidth, inputDrop, customRules } = input

  const [width, drop] = await Promise.all([
    widthRepository.findNearest(inputWidth),
    dropRepository.findNearest(inputDrop),
  ])

  if (!width || !drop) {
    throw new Error('No width/drop configured for the provided dimensions')
  }

  const baseRow = await pricingGridRepository.findBasePrice(
    fabricGroupId,
    width.id,
    drop.id
  )

  if (!baseRow) {
    throw new Error('No base price configured for the provided combination')
  }

  // Always start with costing_rules from the table for this product.
  // When custom rules are provided, override only those rules' values; all others use table values.
  const tableRules = await costingRuleRepository.findByProduct(productId)
  const customMap = new Map<string, number>()
  if (customRules && customRules.length > 0) {
    for (const r of customRules) {
      customMap.set(`${r.rule_name}|${r.rule_type}`, Number(r.value))
    }
  }
  /**
   * Costing sheet rules (table + custom overrides). Rows named "GST" are skipped — the 10% on base is applied in code first.
   */
  const applicableRules = tableRules.filter((r) => r.rule_name.trim().toLowerCase() !== 'gst')

  // 1) Base price from grid, then 10% GST on that base first (e.g. 39 → +3.90 → 42.90)
  const baseWithGst = roundTo2(baseRow.base_price * 1.1)
  let running = baseWithGst
  const ruleBreakdown: CostingRuleBreakdownLine[] = []

  // 2) Remaining costing rules (rental, installation, delivery, etc.)
  for (const r of applicableRules) {
    const key = `${r.rule_name}|${r.rule_type}`
    const override = customMap.get(key)
    const value = override !== undefined ? override : Number(r.value)
    const source = override !== undefined ? ('custom' as const) : ('table' as const)
    let amountAdded = 0
    if (r.rule_type === 'percentage') {
      amountAdded = roundTo2((running * value) / 100)
    } else if (r.rule_type === 'fixed') {
      amountAdded = roundTo2(value)
    }
    running = roundTo2(running + amountAdded)
    ruleBreakdown.push({
      ruleName: r.rule_name,
      ruleType: r.rule_type,
      value,
      source,
      amountAdded,
      runningSubtotal: running,
    })
  }

  // Line amount before quote-level GST; quoteService adds the second 10% on the bill total.
  const subtotalExGst = running

  return {
    fabricGroupId,
    productId,
    inputWidth,
    inputDrop,
    roundedWidthId: width.id,
    roundedDropId: drop.id,
    basePrice: baseRow.base_price,
    subtotal: subtotalExGst,
    gst: 0,
    finalTotal: subtotalExGst,
    costingBreakdown: {
      inputWidth,
      inputDrop,
      roundedWidth: width.width_value,
      roundedDrop: drop.drop_value,
      basePrice: baseRow.base_price,
      baseWithGst,
      rules: ruleBreakdown,
      unitSubtotalExGst: subtotalExGst,
    },
  }
}

