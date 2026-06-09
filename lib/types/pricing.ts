export type FabricGroup = {
  id: number
  group_number: number
}

export type Width = {
  id: number
  width_value: number
}

export type Drop = {
  id: number
  drop_value: number
}

export type RollerPricingGridRow = {
  id: number
  fabric_group_id: number
  width_id: number
  drop_id: number
  base_price: number
}

export type CostingRule = {
  id: number
  product_id: number
  rule_name: string
  rule_type: string
  value: number
}

export type CostingRuleBreakdownLine = {
  ruleName: string
  ruleType: string
  value: number
  /** Whether value came from costing_rules table or a per-quote custom override */
  source: 'table' | 'custom'
  amountAdded: number
  runningSubtotal: number
}

export type PricingCostingBreakdown = {
  inputWidth: number
  inputDrop: number
  roundedWidth: number
  roundedDrop: number
  basePrice: number
  /** Base grid price + 10% GST applied in code before costing rules */
  baseWithGst: number
  rules: CostingRuleBreakdownLine[]
  unitSubtotalExGst: number
}

export type PricingResult = {
  fabricGroupId: number
  productId: number
  inputWidth: number
  inputDrop: number
  roundedWidthId: number
  roundedDropId: number
  basePrice: number
  subtotal: number
  gst: number
  finalTotal: number
  costingBreakdown: PricingCostingBreakdown
}

