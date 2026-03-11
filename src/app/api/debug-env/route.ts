export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NOT SET"
  const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 20) + "..."

  const supabase = createServiceClient()

  // Simple query
  const { data: simple, error: e1, count } = await supabase
    .from("supplier_quote_items")
    .select("id, product_name, supplier_quote_id", { count: "exact" })
    .limit(5)

  // Full query like materials route
  const { data: full, error: e2 } = await supabase
    .from("supplier_quote_items")
    .select(`*, supplier:suppliers(id, name), category:categories(id, name), quote:supplier_quotes(quote_date, expiry_date)`)
    .limit(5)

  return NextResponse.json({ url, keyPrefix, count, simpleItems: simple, fullItems: full, e1: e1?.message, e2: e2?.message })
}
