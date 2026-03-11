export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NOT SET"
  const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 20) + "..."

  const supabase = createServiceClient()
  const { data, error, count } = await supabase
    .from("supplier_quote_items")
    .select("id, product_name, supplier_quote_id", { count: "exact" })
    .limit(5)

  return NextResponse.json({ url, keyPrefix, count, items: data, error: error?.message })
}
