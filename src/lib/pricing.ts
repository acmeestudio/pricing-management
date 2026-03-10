/**
 * Utilidades de cálculo de precios para Acme Estudio
 * Moneda: COP (Pesos Colombianos)
 * IVA: 19% (configurable por producto)
 */

export interface PricingConfig {
  productionCost: number      // Suma de costos de materiales (de la receta)
  additionalCosts: number     // Costos extras: mano de obra, transporte, etc.
  marginPercentage: number    // Margen de ganancia (ej. 45 para 45%)
  ivaPercentage: number       // IVA (ej. 19 para 19%)
}

export interface PricingResult {
  productionCost: number
  additionalCosts: number
  totalCost: number
  salePriceBeforeIva: number
  ivaAmount: number
  salePriceWithIva: number
  profitPerUnit: number
  profitPercentage: number
}

/**
 * Calcula todos los precios de un producto vendible
 */
export function calculatePricing(config: PricingConfig): PricingResult {
  const { productionCost, additionalCosts, marginPercentage, ivaPercentage } = config

  const totalCost = productionCost + additionalCosts

  // Precio de venta sin IVA usando mark-up sobre costo
  // sale_price = total_cost / (1 - margin/100)
  const margin = Math.min(marginPercentage, 99.99) // Evitar división por cero
  const salePriceBeforeIva = totalCost / (1 - margin / 100)

  const ivaAmount = salePriceBeforeIva * (ivaPercentage / 100)
  const salePriceWithIva = salePriceBeforeIva + ivaAmount
  const profitPerUnit = salePriceBeforeIva - totalCost
  const profitPercentage = salePriceBeforeIva > 0
    ? (profitPerUnit / salePriceBeforeIva) * 100
    : 0

  return {
    productionCost,
    additionalCosts,
    totalCost,
    salePriceBeforeIva,
    ivaAmount,
    salePriceWithIva,
    profitPerUnit,
    profitPercentage,
  }
}

/**
 * Calcula el costo de línea de un ítem de receta
 */
export function calculateLineCost(quantityNeeded: number, unitCost: number): number {
  return quantityNeeded * unitCost
}

/**
 * Formatea un número como precio COP
 * Ejemplo: 1500000 → "$1.500.000"
 */
export function formatCOP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0'

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatea un número como precio COP con decimales
 */
export function formatCOPDetailed(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0,00'

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Parsea un string de precio COP a número
 * Ejemplo: "$1.500.000" → 1500000
 */
export function parseCOP(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Formatea un porcentaje
 * Ejemplo: 45.5 → "45,5%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%'
  return `${value.toFixed(1).replace('.', ',')}%`
}

/**
 * Badge de prioridad de cotización
 */
export function getPriorityBadge(priority: number | null): {
  label: string
  color: 'green' | 'yellow' | 'red' | 'gray'
  emoji: string
} {
  if (priority === null) return { label: 'Sin prioridad', color: 'gray', emoji: '⚪' }
  if (priority === 1) return { label: 'Prioridad 1', color: 'green', emoji: '🟢' }
  if (priority === 2) return { label: 'Prioridad 2', color: 'yellow', emoji: '🟡' }
  return { label: `Prioridad ${priority}`, color: 'red', emoji: '🔴' }
}

/**
 * Calcula la vigencia de una cotización
 */
export function isQuoteExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

export function isQuoteOld(quoteDate: string, daysThreshold = 90): boolean {
  const date = new Date(quoteDate)
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - daysThreshold)
  return date < threshold
}
