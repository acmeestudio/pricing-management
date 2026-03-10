export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  // body puede ser un array de ítems o un único ítem
  const items = Array.isArray(body) ? body : [body]

  const { data, error } = await supabase
    .from("supplier_quote_items")
    .insert(items.map(item => ({
      supplier_quote_id: item.supplier_quote_id,
      supplier_id: item.supplier_id || null,
      category_id: item.category_id || null,
      product_name: item.product_name,
      description: item.description || null,
      quantity: item.quantity,
      unit: item.unit || "unidad",
      unit_price_before_iva: item.unit_price_before_iva,
      total_before_iva: item.total_before_iva,
      quote_date: item.quote_date || null,
      notes: item.notes || null,
    })))
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
