// TEMPORARY — delete after migration runs
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { Client } from 'pg'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Extract project ref from URL: https://savnmineaqtfkodgbelk.supabase.co
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

  const connectionConfigs = [
    // Supavisor pooler session mode (port 5432) - service role as password
    {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${projectRef}`,
      password: serviceKey,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
    // Direct connection
    {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: serviceKey,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  ]

  const migration = [
    `ALTER TABLE client_quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`,
    `ALTER TABLE client_quotes ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`,
    `ALTER TABLE client_quotes DROP CONSTRAINT IF EXISTS client_quotes_status_check`,
    `ALTER TABLE client_quotes ADD CONSTRAINT client_quotes_status_check CHECK (status IN ('draft','sent','accepted','rejected','paid'))`,
  ]

  for (const config of connectionConfigs) {
    const client = new Client(config)
    try {
      await client.connect()
      const results = []
      for (const sql of migration) {
        await client.query(sql)
        results.push({ ok: true, sql: sql.slice(0, 60) })
      }
      await client.end()
      return NextResponse.json({ success: true, host: config.host, results })
    } catch (err: unknown) {
      await client.end().catch(() => {})
      const msg = err instanceof Error ? err.message : String(err)
      // Try next config if connection refused
      if (msg.includes('password') || msg.includes('connect') || msg.includes('ENOTFOUND')) {
        continue
      }
      // If it's a SQL error (connected but SQL failed), report it
      return NextResponse.json({ success: false, host: config.host, error: msg })
    }
  }

  return NextResponse.json({
    success: false,
    error: 'No connection method worked. Please run the SQL manually in Supabase SQL Editor.',
    sql: migration.join(';\n'),
  })
}
