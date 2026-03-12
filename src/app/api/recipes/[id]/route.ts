export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const body = await request.json()

  const lineCost = (body.quantity_needed || 0) * (body.unit_cost || 0)

  const { data, error } = await supabase
    .from("product_recipes")
    .update({
      ...body,
      line_cost: lineCost || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcular precios del producto
  if (data?.sellable_product_id) {
    await supabase.rpc("recalculate_sellable_product", {
      p_product_id: data.sellable_product_id,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  // Obtener producto_id antes de eliminar
  const { data: recipe } = await supabase
    .from("product_recipes")
    .select("sellable_product_id")
    .eq("id", params.id)
    .single()

  const { error } = await supabase.from("product_recipes").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcular precios
  if (recipe?.sellable_product_id) {
    await supabase.rpc("recalculate_sellable_product", {
      p_product_id: recipe.sellable_product_id,
    })
  }

  return NextResponse.json({ success: true })
}
