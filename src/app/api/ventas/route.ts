export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get("category")
  const statusFilter = searchParams.get("status") // accepted, paid, all

  // Cotizaciones aceptadas y pagadas con sus items
  let query = supabase
    .from("client_quotes")
    .select(`
      id,
      quote_number,
      client_name,
      quote_date,
      accepted_at,
      paid_at,
      status,
      subtotal_before_iva,
      iva_amount,
      total_with_iva,
      items:client_quote_items(
        id,
        product_name,
        quantity,
        sale_unit_price,
        sale_total,
        profit,
        sellable_product_id,
        product:sellable_products(id, name, category_id, category:categories(id, name))
      )
    `)
    .in("status", ["accepted", "paid"])
    .order("quote_date", { ascending: false })

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }

  const { data: quotes, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtrar por categoría si se especifica
  let filteredQuotes = quotes ?? []
  if (categoryId) {
    filteredQuotes = filteredQuotes.filter(q =>
      q.items.some((item: any) => item.product?.category_id === categoryId)
    )
  }

  // Calcular resumen
  const totalAceptado = filteredQuotes.reduce((s, q) => s + (q.total_with_iva ?? 0), 0)
  const totalPorCobrar = filteredQuotes
    .filter(q => q.status === "accepted")
    .reduce((s, q) => s + (q.total_with_iva ?? 0), 0)
  const totalCobrado = filteredQuotes
    .filter(q => q.status === "paid")
    .reduce((s, q) => s + (q.total_with_iva ?? 0), 0)

  // Productos más vendidos
  const productMap: Record<string, { name: string; category: string; quantity: number; total: number }> = {}
  for (const q of filteredQuotes) {
    for (const item of q.items as any[]) {
      const key = item.sellable_product_id || item.product_name
      if (!productMap[key]) {
        productMap[key] = {
          name: item.product_name,
          category: item.product?.category?.name ?? "Sin categoría",
          quantity: 0,
          total: 0,
        }
      }
      productMap[key].quantity += item.quantity
      productMap[key].total += item.sale_total
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total)

  return NextResponse.json({
    quotes: filteredQuotes,
    summary: {
      totalAceptado,
      totalPorCobrar,
      totalCobrado,
      countAceptado: filteredQuotes.filter(q => q.status === "accepted").length,
      countPagado: filteredQuotes.filter(q => q.status === "paid").length,
    },
    topProducts,
  })
}
