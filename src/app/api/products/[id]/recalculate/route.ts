export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { error } = await supabase.rpc("recalculate_sellable_product", {
    p_product_id: params.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Devolver el producto actualizado
  const { data } = await supabase
    .from("sellable_products")
    .select("*")
    .eq("id", params.id)
    .single()

  return NextResponse.json(data)
}
