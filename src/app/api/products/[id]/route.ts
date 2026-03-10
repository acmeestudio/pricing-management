export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("sellable_products")
    .select(`
      *,
      category:categories(id, name),
      recipes:product_recipes(
        *,
        category:categories(id, name),
        quote_item:supplier_quote_items(
          *,
          supplier:suppliers(id, name)
        )
      )
    `)
    .eq("id", params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("sellable_products")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { error } = await supabase.from("sellable_products").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
