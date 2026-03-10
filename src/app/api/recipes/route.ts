export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("product_id")

  if (!productId) {
    return NextResponse.json({ error: "product_id es requerido" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("product_recipes")
    .select(`
      *,
      category:categories(id, name),
      quote_item:supplier_quote_items(
        id, product_name, unit_price_before_iva, unit, priority,
        supplier:suppliers(id, name)
      )
    `)
    .eq("sellable_product_id", productId)
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const lineCost = (body.quantity_needed || 0) * (body.unit_cost || 0)

  const { data, error } = await supabase
    .from("product_recipes")
    .insert({
      sellable_product_id: body.sellable_product_id,
      supplier_quote_item_id: body.supplier_quote_item_id || null,
      material_name: body.material_name,
      material_category_id: body.material_category_id || null,
      quantity_needed: body.quantity_needed,
      unit: body.unit || "unidad",
      unit_cost: body.unit_cost || null,
      line_cost: lineCost || null,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcular precios del producto
  await supabase.rpc("recalculate_sellable_product", {
    p_product_id: body.sellable_product_id,
  })

  return NextResponse.json(data, { status: 201 })
}
