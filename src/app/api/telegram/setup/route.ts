import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 })
  }
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL no configurado' }, { status: 500 })
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  }
  if (secret) {
    body.secret_token = secret
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const result = await response.json()
  return NextResponse.json(result)
}
