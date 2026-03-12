export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import * as pdfParseModule from 'pdf-parse'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function sendMessage(
  chatId: number | string,
  text: string,
  options?: Record<string, unknown>
) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  })
}

async function answerCallbackQuery(id: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  })
}

async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string
) {
  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
  })
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

// ─── GPT-4o extraction ───────────────────────────────────────────────────────

interface ExtractedSupplier {
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  nit: string | null
}

interface ExtractedQuote {
  reference: string | null
  quote_date: string
  expiry_date: string | null
  notes: string | null
}

interface ExtractedItem {
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
}

interface ExtractedData {
  supplier: ExtractedSupplier
  quote: ExtractedQuote
  items: ExtractedItem[]
}

async function extractPdfData(pdfText: string): Promise<ExtractedData> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Eres un asistente experto en extraer información de cotizaciones de proveedores colombianos. ' +
          'Extrae los datos del texto del PDF y devuelve un JSON con la estructura exacta indicada. ' +
          'Los precios deben ser en COP sin IVA. Si un campo no aparece, usa null. ' +
          'Las fechas deben ser en formato YYYY-MM-DD. ' +
          'Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código.',
      },
      {
        role: 'user',
        content:
          `Extrae la información de esta cotización y devuelve JSON con esta estructura exacta:\n` +
          `{\n` +
          `  "supplier": { "name": "...", "contact_name": null, "email": null, "phone": null, "city": null, "nit": null },\n` +
          `  "quote": { "reference": null, "quote_date": "YYYY-MM-DD", "expiry_date": null, "notes": null },\n` +
          `  "items": [{ "product_name": "...", "description": null, "quantity": 1, "unit": "unidad", "unit_price_before_iva": 0 }]\n` +
          `}\n\n` +
          `TEXTO DEL PDF:\n${pdfText}`,
      },
    ],
    temperature: 0,
  })

  const raw = response.choices[0]?.message?.content?.trim() || '{}'
  return JSON.parse(raw) as ExtractedData
}

// ─── PDF handler ─────────────────────────────────────────────────────────────

async function handlePdfDocument(
  chatId: number | string,
  fileId: string
) {
  await sendMessage(chatId, '📄 Analizando cotización con IA... un momento.')

  // 1. Download file from Telegram
  const fileInfoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  const fileInfo = await fileInfoRes.json()
  const filePath: string = fileInfo?.result?.file_path
  if (!filePath) {
    await sendMessage(chatId, 'No pude descargar el archivo. Inténtalo de nuevo.')
    return
  }

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${TOKEN}/${filePath}`
  )
  const pdfBuffer = Buffer.from(await fileRes.arrayBuffer())

  // 2. Extract text with pdf-parse
  let pdfText = ''
  try {
    const parsed = await pdfParse(pdfBuffer)
    pdfText = parsed.text
  } catch {
    await sendMessage(chatId, 'No pude leer el PDF. Asegúrate de que no esté protegido.')
    return
  }

  if (!pdfText.trim()) {
    await sendMessage(chatId, 'El PDF no contiene texto legible. Puede ser una imagen escaneada.')
    return
  }

  // 3. Extract structured data with GPT-4o
  let data: ExtractedData
  try {
    data = await extractPdfData(pdfText)
  } catch (err) {
    console.error('GPT-4o extraction error:', err)
    await sendMessage(chatId, 'Error al analizar el PDF con IA. Inténtalo desde la web app.')
    return
  }

  if (!data.items?.length) {
    await sendMessage(chatId, 'No pude extraer ítems de este PDF. Inténtalo desde la web app.')
    return
  }

  // 4. Save to Supabase
  const supabase = createServiceClient()

  // Find or create supplier
  let supplierId: string
  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id')
    .ilike('name', data.supplier.name)
    .maybeSingle()

  if (existingSupplier) {
    supplierId = existingSupplier.id
  } else {
    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        name: data.supplier.name,
        contact_name: data.supplier.contact_name,
        email: data.supplier.email,
        phone: data.supplier.phone,
        city: data.supplier.city,
        notes: data.supplier.nit ? `NIT: ${data.supplier.nit}` : null,
      })
      .select('id')
      .single()

    if (supplierError || !newSupplier) {
      console.error('Supplier insert error:', supplierError)
      await sendMessage(chatId, 'Error al guardar el proveedor en la base de datos.')
      return
    }
    supplierId = newSupplier.id
  }

  // Calculate totals
  const subtotal = data.items.reduce(
    (sum, item) => sum + item.unit_price_before_iva * item.quantity,
    0
  )
  const ivaAmount = subtotal * 0.19
  const totalWithIva = subtotal + ivaAmount

  // Create supplier_quote
  const { data: quote, error: quoteError } = await supabase
    .from('supplier_quotes')
    .insert({
      supplier_id: supplierId,
      quote_reference: data.quote.reference,
      quote_date: data.quote.quote_date || new Date().toISOString().split('T')[0],
      expiry_date: data.quote.expiry_date,
      currency: 'COP',
      status: 'pending',
      source: 'telegram',
      notes: data.quote.notes,
      subtotal_before_iva: subtotal,
      iva_amount: ivaAmount,
      total_with_iva: totalWithIva,
    })
    .select('id')
    .single()

  if (quoteError || !quote) {
    console.error('Quote insert error:', quoteError)
    await sendMessage(chatId, 'Error al guardar la cotización en la base de datos.')
    return
  }

  // Insert items
  const itemRows = data.items.map((item) => ({
    supplier_quote_id: quote.id,
    supplier_id: supplierId,
    product_name: item.product_name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price_before_iva: item.unit_price_before_iva,
    total_before_iva: item.unit_price_before_iva * item.quantity,
    is_approved: false,
    quote_date: data.quote.quote_date || new Date().toISOString().split('T')[0],
  }))

  const { error: itemsError } = await supabase
    .from('supplier_quote_items')
    .insert(itemRows)

  if (itemsError) {
    console.error('Items insert error:', itemsError)
    await sendMessage(chatId, 'Error al guardar los ítems de la cotización.')
    return
  }

  // 5. Build summary message
  const displayItems = data.items.slice(0, 10)
  const more = data.items.length > 10 ? `\n... y ${data.items.length - 10} más` : ''

  const itemLines = displayItems
    .map(
      (item, i) =>
        `${i + 1}. ${item.product_name} — ${item.quantity} ${item.unit} — ${formatCOP(item.unit_price_before_iva)}/${item.unit}`
    )
    .join('\n')

  const summaryText =
    `📋 Cotización de ${data.supplier.name}\n` +
    `${data.items.length} ítems detectados\n\n` +
    `${itemLines}${more}\n\n` +
    `Subtotal (sin IVA): ${formatCOP(subtotal)}\n` +
    `IVA (19%): ${formatCOP(ivaAmount)}\n` +
    `Total: ${formatCOP(totalWithIva)}\n\n` +
    `¿Qué deseas hacer con esta cotización?`

  await sendMessage(chatId, summaryText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Aprobar', callback_data: `approve:${quote.id}` },
          { text: '❌ Descartar', callback_data: `reject:${quote.id}` },
        ],
      ],
    },
  })
}

// ─── Callback query handler ──────────────────────────────────────────────────

async function handleCallbackQuery(
  callbackQueryId: string,
  chatId: number | string,
  messageId: number,
  data: string
) {
  const supabase = createServiceClient()

  if (data.startsWith('approve:')) {
    const quoteId = data.replace('approve:', '')

    const { error } = await supabase
      .from('supplier_quotes')
      .update({ status: 'approved' })
      .eq('id', quoteId)

    await answerCallbackQuery(callbackQueryId, 'Cotización aprobada')

    if (error) {
      await editMessageText(chatId, messageId, '❌ Error al aprobar la cotización.')
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      await editMessageText(
        chatId,
        messageId,
        `✅ Cotización aprobada correctamente.\n\nVer en la app: ${appUrl}/supplier-quotes`
      )
    }
  } else if (data.startsWith('reject:')) {
    const quoteId = data.replace('reject:', '')

    // Delete items first, then the quote
    await supabase.from('supplier_quote_items').delete().eq('supplier_quote_id', quoteId)
    const { error } = await supabase.from('supplier_quotes').delete().eq('id', quoteId)

    await answerCallbackQuery(callbackQueryId, 'Cotización descartada')

    if (error) {
      await editMessageText(chatId, messageId, '❌ Error al descartar la cotización.')
    } else {
      await editMessageText(chatId, messageId, '🗑️ Cotización descartada y eliminada.')
    }
  } else {
    await answerCallbackQuery(callbackQueryId)
  }
}

// ─── Text chat handler ────────────────────────────────────────────────────────

async function handleTextMessage(chatId: number | string, text: string) {
  const supabase = createServiceClient()

  // Fetch some materials context for GPT-4o
  const { data: materials } = await supabase
    .from('supplier_quote_items')
    .select('product_name, unit_price_before_iva, unit')
    .eq('is_approved', true)
    .order('product_name')
    .limit(50)

  const materialsContext =
    materials && materials.length > 0
      ? materials
          .map((m) => `- ${m.product_name}: ${formatCOP(m.unit_price_before_iva)}/${m.unit}`)
          .join('\n')
      : 'No hay materiales registrados aún.'

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Eres el asistente de Acme Estudio, una empresa de diseño y fabricación de muebles en Colombia. ' +
          'Ayudas con precios de materiales, costos de producción y cotizaciones de proveedores. ' +
          'Responde siempre en español, de forma concisa y útil. ' +
          'Todos los precios son en COP (pesos colombianos).\n\n' +
          `Materiales disponibles con precio aprobado:\n${materialsContext}`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.7,
    max_tokens: 500,
  })

  const reply =
    response.choices[0]?.message?.content?.trim() ||
    'No pude generar una respuesta. Inténtalo de nuevo.'

  await sendMessage(chatId, reply)
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Validate secret token
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: Record<string, unknown>
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    // Handle callback_query (inline button presses)
    if (update.callback_query) {
      const cq = update.callback_query as {
        id: string
        data: string
        message: { chat: { id: number }; message_id: number }
      }
      await handleCallbackQuery(
        cq.id,
        cq.message.chat.id,
        cq.message.message_id,
        cq.data
      )
      return NextResponse.json({ ok: true })
    }

    // Handle regular messages
    if (update.message) {
      const message = update.message as {
        chat: { id: number }
        document?: { file_id: string; mime_type: string }
        text?: string
      }
      const chatId = message.chat.id

      // PDF document
      if (message.document && message.document.mime_type === 'application/pdf') {
        await handlePdfDocument(chatId, message.document.file_id)
        return NextResponse.json({ ok: true })
      }

      // Non-PDF document
      if (message.document) {
        await sendMessage(chatId, 'Por favor envía un archivo PDF de cotización.')
        return NextResponse.json({ ok: true })
      }

      // Text message
      if (message.text) {
        await handleTextMessage(chatId, message.text)
        return NextResponse.json({ ok: true })
      }
    }
  } catch (err) {
    console.error('Telegram webhook error:', err)
  }

  // Always return 200 so Telegram doesn't retry
  return NextResponse.json({ ok: true })
}
