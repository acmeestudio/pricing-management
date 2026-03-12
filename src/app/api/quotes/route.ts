export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const supplierId = searchParams.get("supplier_id")
  const status = searchParams.get("status")

  let query = supabase
    .from("supplier_quotes")
    .select(`
      *,
      supplier:suppliers(id, name)
    `)
    .order("created_at", { ascending: false })

  if (supplierId) query = query.eq("supplier_id", supplierId)
  if (status) query = query.eq("status", status as 'pending' | 'approved' | 'partial' | 'rejected')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("supplier_quotes")
    .insert({
      supplier_id: body.supplier_id || null,
      quote_reference: body.quote_reference || null,
      quote_date: body.quote_date,
      expiry_date: body.expiry_date || null,
      pdf_storage_path: body.pdf_storage_path || null,
      raw_text: body.raw_text || null,
      subtotal_before_iva: body.subtotal_before_iva || null,
      iva_amount: body.iva_amount || null,
      total_with_iva: body.total_with_iva || null,
      status: body.status || "pending",
      source: body.source || "web",
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
