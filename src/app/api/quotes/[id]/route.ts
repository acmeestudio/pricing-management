export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("supplier_quotes")
    .select(`
      *,
      supplier:suppliers(*),
      items:supplier_quote_items(*, category:categories(id, name))
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
    .from("supplier_quotes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  // Get the supplier_id before deleting
  const { data: quote } = await supabase
    .from("supplier_quotes")
    .select("supplier_id")
    .eq("id", params.id)
    .single()

  // Delete items first (correct column: supplier_quote_id)
  const { error: itemsError } = await supabase
    .from("supplier_quote_items")
    .delete()
    .eq("supplier_quote_id", params.id)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  // Delete the quote
  const { error } = await supabase.from("supplier_quotes").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If supplier exists, delete it if it has no remaining quotes
  if (quote?.supplier_id) {
    const { count } = await supabase
      .from("supplier_quotes")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", quote.supplier_id)

    if (count === 0) {
      await supabase.from("suppliers").delete().eq("id", quote.supplier_id)
    }
  }

  return NextResponse.json({ success: true })
}
