export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("suppliers")
    .update({
      name: body.name,
      contact_name: body.contact_name || null,
      phone: body.phone || null,
      email: body.email || null,
      city: body.city || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

