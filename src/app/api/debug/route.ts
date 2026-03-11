export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServiceClient()

  const [
    { data: suppliers, error: e1 },
    { data: quotes, error: e2 },
    { data: allItems, error: e3 },
    { data: approvedItems, error: e4 },
  ] = await Promise.all([
    supabase.from("suppliers").select("id, name").limit(10),
    supabase.from("supplier_quotes").select("id, status").limit(10),
    supabase.from("supplier_quote_items").select("id, product_name, is_approved").limit(20),
    supabase.from("supplier_quote_items").select("id, product_name, is_approved").eq("is_approved", true).limit(20),
  ])

  return NextResponse.json({
    env: {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
      anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
      service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    },
    suppliers: { data: suppliers, error: e1?.message },
    quotes: { data: quotes, error: e2?.message },
    allItems: { data: allItems, error: e3?.message, count: allItems?.length },
    approvedItems: { data: approvedItems, error: e4?.message, count: approvedItems?.length },
  })
}
