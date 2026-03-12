export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("client_quotes")
    .select(`*, items:client_quote_items(*)`)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { items, ...quoteData } = body

  // Crear cotización (quote_number lo genera el trigger)
  const { data: quote, error: quoteError } = await supabase
    .from("client_quotes")
    .insert({
      quote_number: "",
      client_name: quoteData.client_name,
      client_email: quoteData.client_email || null,
      client_phone: quoteData.client_phone || null,
      quote_date: quoteData.quote_date || new Date().toISOString().split("T")[0],
      validity_days: quoteData.validity_days || 30,
      iva_percentage: quoteData.iva_percentage || 19,
      status: "draft",
      notes: quoteData.notes || null,
    })
    .select()
    .single()

  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })

  // Insertar ítems
  if (items?.length) {
    const subtotal = items.reduce((sum: number, i: { sale_total: number }) => sum + i.sale_total, 0)
    const ivaAmount = subtotal * (quoteData.iva_percentage || 19) / 100

    const { error: itemsError } = await supabase
      .from("client_quote_items")
      .insert(items.map((item: {
        sellable_product_id?: string
        product_name: string
        description?: string
        quantity: number
        unit?: string
        production_cost: number
        margin_percentage: number
        sale_unit_price: number
        sale_total: number
        profit: number
      }) => ({
        client_quote_id: quote.id,
        sellable_product_id: item.sellable_product_id || null,
        product_name: item.product_name,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit || "unidad",
        production_cost: item.production_cost,
        margin_percentage: item.margin_percentage,
        sale_unit_price: item.sale_unit_price,
        sale_total: item.sale_total,
        profit: item.profit,
      })))

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    // Actualizar totales
    await supabase
      .from("client_quotes")
      .update({
        subtotal_before_iva: subtotal,
        iva_amount: ivaAmount,
        total_with_iva: subtotal + ivaAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id)
  }

  return NextResponse.json(quote, { status: 201 })
}
