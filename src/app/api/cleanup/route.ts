export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

// POST /api/cleanup  body: { keep_quote_id: string }
// Deletes all supplier_quotes (and their items + orphan suppliers) EXCEPT the specified one
export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { keep_quote_id } = await request.json()

  if (!keep_quote_id) {
    return NextResponse.json({ error: "keep_quote_id requerido" }, { status: 400 })
  }

  // Get all quotes except the one to keep
  const { data: quotesToDelete } = await supabase
    .from("supplier_quotes")
    .select("id, supplier_id")
    .neq("id", keep_quote_id)

  const quoteIdsToDelete = (quotesToDelete || []).map((q) => q.id)
  let deletedItems = 0
  let deletedQuotes = 0
  let deletedSuppliers = 0

  if (quoteIdsToDelete.length > 0) {
    // 1. Delete items of those quotes
    const { data: deletedItemsData, error: itemsError } = await supabase
      .from("supplier_quote_items")
      .delete()
      .in("supplier_quote_id", quoteIdsToDelete)
      .select("id")
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
    deletedItems = deletedItemsData?.length || 0

    // 2. Delete the quotes themselves
    const { data: deletedQuotesData, error: quotesError } = await supabase
      .from("supplier_quotes")
      .delete()
      .in("id", quoteIdsToDelete)
      .select("id")
    if (quotesError) return NextResponse.json({ error: quotesError.message }, { status: 500 })
    deletedQuotes = deletedQuotesData?.length || 0
  }

  // 3. Delete orphan items (supplier_quote_id references a quote that no longer exists)
  const { data: allItems } = await supabase
    .from("supplier_quote_items")
    .select("id, supplier_quote_id")
  const { data: validQuotes } = await supabase
    .from("supplier_quotes")
    .select("id")
  const validQuoteIds = new Set((validQuotes || []).map((q) => q.id))
  const orphanItemIds = (allItems || [])
    .filter((i) => !i.supplier_quote_id || !validQuoteIds.has(i.supplier_quote_id))
    .map((i) => i.id)

  if (orphanItemIds.length > 0) {
    const { data: deletedOrphans, error: orphanError } = await supabase
      .from("supplier_quote_items")
      .delete()
      .in("id", orphanItemIds)
      .select("id")
    if (orphanError) return NextResponse.json({ error: orphanError.message }, { status: 500 })
    deletedItems += deletedOrphans?.length || 0
  }

  // 3. Delete orphan suppliers (no remaining quotes)
  const { data: allSuppliers } = await supabase.from("suppliers").select("id")
  const { data: quotesWithSuppliers } = await supabase
    .from("supplier_quotes")
    .select("supplier_id")
  const suppliersWithQuotes = new Set(
    (quotesWithSuppliers || []).map((q) => q.supplier_id).filter(Boolean)
  )
  const orphanSupplierIds = (allSuppliers || [])
    .filter((s) => !suppliersWithQuotes.has(s.id))
    .map((s) => s.id)

  if (orphanSupplierIds.length > 0) {
    const { data: deletedSuppliersData, error: suppliersError } = await supabase
      .from("suppliers")
      .delete()
      .in("id", orphanSupplierIds)
      .select("id")
    if (suppliersError) return NextResponse.json({ error: suppliersError.message }, { status: 500 })
    deletedSuppliers = deletedSuppliersData?.length || 0
  }

  return NextResponse.json({
    deletedItems,
    deletedQuotes,
    deletedSuppliers,
    debug: { orphanItemIds: orphanItemIds.length, totalItems: allItems?.length, validQuotes: validQuotes?.length }
  })
}
