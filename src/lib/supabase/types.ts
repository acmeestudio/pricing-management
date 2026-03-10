export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          phone: string | null
          email: string | null
          city: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_quotes: {
        Row: {
          id: string
          supplier_id: string | null
          quote_reference: string | null
          quote_date: string
          expiry_date: string | null
          pdf_storage_path: string | null
          raw_text: string | null
          subtotal_before_iva: number | null
          iva_amount: number | null
          total_with_iva: number | null
          currency: string
          status: 'pending' | 'approved' | 'partial' | 'rejected'
          source: 'web' | 'telegram'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          quote_reference?: string | null
          quote_date: string
          expiry_date?: string | null
          pdf_storage_path?: string | null
          raw_text?: string | null
          subtotal_before_iva?: number | null
          iva_amount?: number | null
          total_with_iva?: number | null
          currency?: string
          status?: 'pending' | 'approved' | 'partial' | 'rejected'
          source?: 'web' | 'telegram'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          supplier_id?: string | null
          quote_reference?: string | null
          quote_date?: string
          expiry_date?: string | null
          pdf_storage_path?: string | null
          raw_text?: string | null
          subtotal_before_iva?: number | null
          iva_amount?: number | null
          total_with_iva?: number | null
          currency?: string
          status?: 'pending' | 'approved' | 'partial' | 'rejected'
          source?: 'web' | 'telegram'
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_quote_items: {
        Row: {
          id: string
          supplier_quote_id: string | null
          supplier_id: string | null
          category_id: string | null
          product_name: string
          description: string | null
          quantity: number
          unit: string
          unit_price_before_iva: number
          total_before_iva: number
          priority: number | null
          is_approved: boolean
          quote_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_quote_id?: string | null
          supplier_id?: string | null
          category_id?: string | null
          product_name: string
          description?: string | null
          quantity: number
          unit?: string
          unit_price_before_iva: number
          total_before_iva: number
          priority?: number | null
          is_approved?: boolean
          quote_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          supplier_quote_id?: string | null
          supplier_id?: string | null
          category_id?: string | null
          product_name?: string
          description?: string | null
          quantity?: number
          unit?: string
          unit_price_before_iva?: number
          total_before_iva?: number
          priority?: number | null
          is_approved?: boolean
          quote_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_items_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      sellable_products: {
        Row: {
          id: string
          name: string
          description: string | null
          category_id: string | null
          margin_percentage: number
          iva_percentage: number
          additional_costs: number | null
          production_cost: number | null
          total_cost: number | null
          sale_price_before_iva: number | null
          iva_amount: number | null
          sale_price_with_iva: number | null
          profit_per_unit: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category_id?: string | null
          margin_percentage?: number
          iva_percentage?: number
          additional_costs?: number | null
          production_cost?: number | null
          total_cost?: number | null
          sale_price_before_iva?: number | null
          iva_amount?: number | null
          sale_price_with_iva?: number | null
          profit_per_unit?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          category_id?: string | null
          margin_percentage?: number
          iva_percentage?: number
          additional_costs?: number | null
          production_cost?: number | null
          total_cost?: number | null
          sale_price_before_iva?: number | null
          iva_amount?: number | null
          sale_price_with_iva?: number | null
          profit_per_unit?: number | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellable_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      product_recipes: {
        Row: {
          id: string
          sellable_product_id: string
          supplier_quote_item_id: string | null
          material_name: string
          material_category_id: string | null
          quantity_needed: number
          unit: string
          unit_cost: number | null
          line_cost: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sellable_product_id: string
          supplier_quote_item_id?: string | null
          material_name: string
          material_category_id?: string | null
          quantity_needed: number
          unit?: string
          unit_cost?: number | null
          line_cost?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          sellable_product_id?: string
          supplier_quote_item_id?: string | null
          material_name?: string
          material_category_id?: string | null
          quantity_needed?: number
          unit?: string
          unit_cost?: number | null
          line_cost?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_sellable_product_id_fkey"
            columns: ["sellable_product_id"]
            isOneToOne: false
            referencedRelation: "sellable_products"
            referencedColumns: ["id"]
          }
        ]
      }
      client_quotes: {
        Row: {
          id: string
          quote_number: string
          client_name: string
          client_email: string | null
          client_phone: string | null
          quote_date: string
          validity_days: number
          subtotal_before_iva: number | null
          iva_percentage: number
          iva_amount: number | null
          total_with_iva: number | null
          pdf_storage_path: string | null
          status: 'draft' | 'sent' | 'accepted' | 'rejected'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quote_number?: string
          client_name: string
          client_email?: string | null
          client_phone?: string | null
          quote_date?: string
          validity_days?: number
          subtotal_before_iva?: number | null
          iva_percentage?: number
          iva_amount?: number | null
          total_with_iva?: number | null
          pdf_storage_path?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          quote_number?: string
          client_name?: string
          client_email?: string | null
          client_phone?: string | null
          quote_date?: string
          validity_days?: number
          subtotal_before_iva?: number | null
          iva_percentage?: number
          iva_amount?: number | null
          total_with_iva?: number | null
          pdf_storage_path?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_quote_items: {
        Row: {
          id: string
          client_quote_id: string
          sellable_product_id: string | null
          product_name: string
          description: string | null
          quantity: number
          unit: string
          production_cost: number
          margin_percentage: number
          sale_unit_price: number
          sale_total: number
          profit: number
          created_at: string
        }
        Insert: {
          id?: string
          client_quote_id: string
          sellable_product_id?: string | null
          product_name: string
          description?: string | null
          quantity: number
          unit?: string
          production_cost: number
          margin_percentage: number
          sale_unit_price: number
          sale_total: number
          profit: number
          created_at?: string
        }
        Update: {
          sellable_product_id?: string | null
          product_name?: string
          description?: string | null
          quantity?: number
          unit?: string
          production_cost?: number
          margin_percentage?: number
          sale_unit_price?: number
          sale_total?: number
          profit?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_quote_items_client_quote_id_fkey"
            columns: ["client_quote_id"]
            isOneToOne: false
            referencedRelation: "client_quotes"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalculate_sellable_product: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      recalculate_priorities: {
        Args: { p_product_name: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Tipos de conveniencia
export type Category = Database['public']['Tables']['categories']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type SupplierQuote = Database['public']['Tables']['supplier_quotes']['Row']
export type SupplierQuoteItem = Database['public']['Tables']['supplier_quote_items']['Row']
export type SellableProduct = Database['public']['Tables']['sellable_products']['Row']
export type ProductRecipe = Database['public']['Tables']['product_recipes']['Row']
export type ClientQuote = Database['public']['Tables']['client_quotes']['Row']
export type ClientQuoteItem = Database['public']['Tables']['client_quote_items']['Row']

// Tipos con joins
export type SupplierQuoteWithItems = SupplierQuote & {
  supplier: Supplier | null
  items: SupplierQuoteItem[]
}

export type ProductRecipeWithItem = ProductRecipe & {
  quote_item: (SupplierQuoteItem & { supplier: Supplier | null }) | null
  category: Category | null
}

export type SellableProductWithRecipe = SellableProduct & {
  category: Category | null
  recipes: ProductRecipeWithItem[]
}

export type ClientQuoteWithItems = ClientQuote & {
  items: (ClientQuoteItem & { product: SellableProduct | null })[]
}
