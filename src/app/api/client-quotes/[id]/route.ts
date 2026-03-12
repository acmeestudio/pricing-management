export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("client_quotes")
    .select(`
      *,
      items:client_quote_items(
        *,
        product:sellable_products(id, name)
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
    .from("client_quotes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { error: itemsError } = await supabase
    .from("client_quote_items")
    .delete()
    .eq("client_quote_id", params.id)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  const { error } = await supabase.from("client_quotes").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
