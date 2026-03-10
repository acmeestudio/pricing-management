export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")
  const categoryId = searchParams.get("category_id")

  // Vista consolidada: todos los ítems aprobados agrupados por nombre de producto
  let query = supabase
    .from("supplier_quote_items")
    .select(`
      *,
      supplier:suppliers(id, name),
      category:categories(id, name),
      quote:supplier_quotes(quote_date, expiry_date)
    `)
    .eq("is_approved", true)
    .order("product_name")
    .order("priority")

  if (search) query = query.ilike("product_name", `%${search}%`)
  if (categoryId) query = query.eq("category_id", categoryId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
