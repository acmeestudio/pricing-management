export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: body.name,
      contact_name: body.contact_name || null,
      phone: body.phone || null,
      email: body.email || null,
      city: body.city || null,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
