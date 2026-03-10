export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  // body: { item_ids: string[], quote_id: string }
  const { item_ids, quote_id } = body

  if (!item_ids?.length) {
    return NextResponse.json({ error: "Se requieren item_ids" }, { status: 400 })
  }

  // 1. Aprobar los ítems
  const { error: approveError } = await supabase
    .from("supplier_quote_items")
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .in("id", item_ids)

  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 500 })
  }

  // 2. Obtener los product_names de los ítems aprobados para recalcular prioridades
  const { data: items } = await supabase
    .from("supplier_quote_items")
    .select("product_name")
    .in("id", item_ids)

  const uniqueNames = Array.from(new Set(items?.map(i => i.product_name) || []))

  // 3. Recalcular prioridades para cada producto
  for (const name of uniqueNames) {
    await supabase.rpc("recalculate_priorities", { p_product_name: name })
  }

  // 4. Actualizar estado de la cotización padre
  if (quote_id) {
    const { data: allItems } = await supabase
      .from("supplier_quote_items")
      .select("is_approved")
      .eq("supplier_quote_id", quote_id)

    const total = allItems?.length || 0
    const approved = allItems?.filter(i => i.is_approved).length || 0

    let newStatus: "pending" | "approved" | "partial" | "rejected" = "pending"
    if (approved === total && total > 0) newStatus = "approved"
    else if (approved > 0) newStatus = "partial"

    await supabase
      .from("supplier_quotes")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", quote_id)
  }

  return NextResponse.json({ success: true, approved_count: item_ids.length })
}
