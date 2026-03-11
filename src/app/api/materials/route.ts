export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")
  const categoryId = searchParams.get("category_id")

  // Vista consolidada: todos los ítems de cotizaciones de proveedores
  let query = supabase
    .from("supplier_quote_items")
    .select(`
      *,
      supplier:suppliers(id, name),
      category:categories(id, name),
      quote:supplier_quotes(quote_date, expiry_date)
    `)
    .order("product_name")
    .order("priority")

  if (search) query = query.ilike("product_name", `%${search}%`)
  if (categoryId) query = query.eq("category_id", categoryId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // TEMP DEBUG: also run a count query to detect cache vs live
  const { count: liveCount } = await supabase
    .from("supplier_quote_items")
    .select("*", { count: "exact", head: true })

  return NextResponse.json({
    items: data,
    _live_count: liveCount,
    _url: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('\n','[NL]'),
    _key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0,15),
  })
}
