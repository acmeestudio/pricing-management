export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NOT SET"
  const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 20) + "..."
  const supabase = createServiceClient()
  const { count } = await supabase
    .from("supplier_quote_items")
    .select("*", { count: "exact", head: true })
  return NextResponse.json({ url, keyPrefix, count })
}

export async function POST() {
  const supabase = createServiceClient()

  // Use join query (same as materials route) to discover the IDs
  const { data: items } = await supabase
    .from("supplier_quote_items")
    .select("id, supplier_quote_id, supplier_id, supplier:suppliers(id), quote:supplier_quotes(id)")

  const itemIds = (items || []).map((i: { id: string }) => i.id)
  const quoteIds: string[] = []
  const supplierIds: string[] = []
  for (const i of (items || []) as { supplier_quote_id: string | null; supplier_id: string | null }[]) {
    if (i.supplier_quote_id && !quoteIds.includes(i.supplier_quote_id)) quoteIds.push(i.supplier_quote_id)
    if (i.supplier_id && !supplierIds.includes(i.supplier_id)) supplierIds.push(i.supplier_id)
  }

  const results: Record<string, string | number> = { found_items: itemIds.length }

  if (itemIds.length > 0) {
    const r1 = await supabase.from("product_recipes").delete().in("supplier_quote_item_id", itemIds)
    const r2 = await supabase.from("supplier_quote_items").delete().in("id", itemIds)
    results.recipes = r1.error?.message ?? "ok"
    results.items = r2.error?.message ?? "ok"
  }
  if (quoteIds.length > 0) {
    const r3 = await supabase.from("supplier_quotes").delete().in("id", quoteIds)
    results.quotes = r3.error?.message ?? "ok"
  }
  if (supplierIds.length > 0) {
    const r4 = await supabase.from("suppliers").delete().in("id", supplierIds)
    results.suppliers = r4.error?.message ?? "ok"
  }

  await supabase.from("client_quote_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("client_quotes").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("product_recipes").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  await supabase.from("sellable_products").delete().neq("id", "00000000-0000-0000-0000-000000000000")

  return NextResponse.json(results)
}
