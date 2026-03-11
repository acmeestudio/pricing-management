export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NOT SET"
  const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 20) + "..."

  const supabase = createServiceClient()
  const { data, error, count } = await supabase
    .from("supplier_quote_items")
    .select("id, product_name", { count: "exact" })
    .limit(10)

  return NextResponse.json({ url, keyPrefix, count, items: data, error: error?.message })
}

// POST: delete ALL data (product_recipes → items → quotes → suppliers)
export async function POST() {
  const supabase = createServiceClient()

  const r1 = await supabase.from("product_recipes").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  const r2 = await supabase.from("supplier_quote_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  const r3 = await supabase.from("supplier_quotes").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  const r4 = await supabase.from("suppliers").delete().neq("id", "00000000-0000-0000-0000-000000000000")

  return NextResponse.json({
    recipes: r1.error?.message ?? "ok",
    items: r2.error?.message ?? "ok",
    quotes: r3.error?.message ?? "ok",
    suppliers: r4.error?.message ?? "ok",
  })
}
