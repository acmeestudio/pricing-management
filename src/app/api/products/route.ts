export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get("category_id")
  const active = searchParams.get("active")

  let query = supabase
    .from("sellable_products")
    .select(`*, category:categories(id, name)`)
    .order("name")

  if (categoryId) query = query.eq("category_id", categoryId)
  if (active === "true") query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("sellable_products")
    .insert({
      name: body.name,
      description: body.description || null,
      category_id: body.category_id || null,
      margin_percentage: body.margin_percentage ?? 45,
      iva_percentage: body.iva_percentage ?? 19,
      additional_costs: body.additional_costs ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
