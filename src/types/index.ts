// Re-exportar tipos de Supabase para conveniencia
export type {
  Category,
  Supplier,
  SupplierQuote,
  SupplierQuoteItem,
  SellableProduct,
  ProductRecipe,
  ClientQuote,
  ClientQuoteItem,
  SupplierQuoteWithItems,
  ProductRecipeWithItem,
  SellableProductWithRecipe,
  ClientQuoteWithItems,
} from '@/lib/supabase/types'

// Tipos para el parseo de Claude AI
export interface ParsedQuoteItem {
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
  total_before_iva: number
}

export interface ParsedQuoteDocument {
  supplier_name: string | null
  quote_reference: string | null
  quote_date: string | null
  expiry_date: string | null
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  iva_included: 'yes' | 'no' | 'unknown'
  items: ParsedQuoteItem[]
}

// Tipos para la API de recetas
export interface RecipeItemFormData {
  material_name: string
  material_category_id: string | null
  quantity_needed: number
  unit: string
  unit_cost: number | null
  supplier_quote_item_id: string | null
  notes: string | null
}

// Tipos para cotización al cliente
export interface ClientQuoteItemFormData {
  sellable_product_id: string
  product_name: string
  description: string | null
  quantity: number
  unit: string
  margin_percentage: number
}

// Estado de los materiales
export type MaterialStatus = 'ok' | 'old' | 'missing'

export interface MaterialWithStatus {
  product_name: string
  category_name: string | null
  suppliers_count: number
  best_price: number | null
  priority_1_supplier: string | null
  last_quote_date: string | null
  status: MaterialStatus
}
