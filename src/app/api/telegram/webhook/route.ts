export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`

// ─── Session state (in-memory, per warm instance) ─────────────────────────────

interface ManualItem {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  categoryId: string | null
}

interface Session {
  flow: 'manual'
  step: 'supplier_name' | 'supplier_nit' | 'quote_date' | 'items' | 'item_category' | 'confirm'
  supplierName: string
  supplierNit: string
  quoteDate: string
  items: ManualItem[]
  pendingItem: Omit<ManualItem, 'categoryId'> | null
}

interface PendingPdfCategory {
  quoteId: string
  supplierName: string
  itemCount: number
  summaryText: string
}

const sessions = new Map<number | string, Session>()
const pendingPdfCategory = new Map<number | string, PendingPdfCategory>()

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function sendMessage(chatId: number | string, text: string, options?: Record<string, unknown>) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options }),
  })
}

async function answerCallbackQuery(id: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  })
}

async function editMessageText(chatId: number | string, messageId: number, text: string, options?: Record<string, unknown>) {
  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...options }),
  })
}

// ─── Category keyboard helper ─────────────────────────────────────────────────

async function sendCategoryKeyboard(
  chatId: number | string,
  text: string,
  callbackPrefix: string,
) {
  const supabase = createServiceClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('name')

  if (!categories?.length) return

  // 2 buttons per row
  const keyboard: { text: string; callback_data: string }[][] = []
  for (let i = 0; i < categories.length; i += 2) {
    const row = [{ text: categories[i].name, callback_data: `${callbackPrefix}:${categories[i].id}` }]
    if (categories[i + 1]) {
      row.push({ text: categories[i + 1].name, callback_data: `${callbackPrefix}:${categories[i + 1].id}` })
    }
    keyboard.push(row)
  }
  keyboard.push([{ text: '⏭️ Sin categoría', callback_data: `${callbackPrefix}:skip` }])

  await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } })
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

function parseDate(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === 'hoy' || trimmed === 'today') return new Date().toISOString().split('T')[0]
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return new Date().toISOString().split('T')[0]
}

function parseItem(input: string): Omit<ManualItem, 'categoryId'> | null {
  const parts = input.split('|').map(p => p.trim())
  if (parts.length < 4) return null
  const name = parts[0]
  const quantity = parseFloat(parts[1].replace(',', '.'))
  const unit = parts[2]
  const price = parseFloat(parts[3].replace(/[.$,]/g, '').replace(',', '.'))
  if (!name || isNaN(quantity) || isNaN(price)) return null
  return { name, quantity, unit: unit || 'unidad', unitPrice: price }
}

// ─── Help message ─────────────────────────────────────────────────────────────

const HELP_TEXT = `🤖 <b>Asistente Acme Estudio</b>

<b>Cotizaciones de proveedores:</b>
📄 Envía un <b>PDF</b> → lo analizo con IA y creo la cotización automáticamente
✍️ /nueva → ingresa una cotización paso a paso de forma manual

<b>Consultas de materiales:</b>
💬 Escríbeme cualquier pregunta sobre precios o materiales
Ej: "¿cuánto cuesta la madera MDF?" o "precios de tornillos"

<b>Comandos:</b>
/nueva — nueva cotización manual
/materiales — listar materiales disponibles
/ayuda — mostrar este menú`

// ─── Manual flow ─────────────────────────────────────────────────────────────

async function startManualFlow(chatId: number | string) {
  sessions.set(chatId as number, {
    flow: 'manual',
    step: 'supplier_name',
    supplierName: '',
    supplierNit: '',
    quoteDate: '',
    items: [],
    pendingItem: null,
  })
  await sendMessage(chatId, '✍️ <b>Nueva cotización manual</b>\n\n¿Cuál es el nombre o razón social del proveedor?')
}

async function handleManualStep(chatId: number | string, text: string, session: Session) {
  const trimmed = text.trim()

  if (trimmed.toLowerCase() === '/cancelar' || trimmed.toLowerCase() === 'cancelar') {
    sessions.delete(chatId as number)
    await sendMessage(chatId, '❌ Cotización cancelada. Escribe /nueva para empezar de nuevo o envía un PDF.')
    return
  }

  // Ignore text if waiting for category button press
  if (session.step === 'item_category') {
    await sendMessage(chatId, '👆 Por favor selecciona la categoría usando los botones de arriba.')
    return
  }

  if (session.step === 'supplier_name') {
    session.supplierName = trimmed
    session.step = 'supplier_nit'
    await sendMessage(chatId, `✅ Proveedor: <b>${trimmed}</b>\n\n¿NIT del proveedor? (escribe <i>no</i> para omitir)`)

  } else if (session.step === 'supplier_nit') {
    session.supplierNit = trimmed.toLowerCase() === 'no' ? '' : trimmed
    session.step = 'quote_date'
    await sendMessage(chatId, '📅 ¿Fecha de la cotización?\nEscribe <b>hoy</b> o en formato <b>DD/MM/AAAA</b>')

  } else if (session.step === 'quote_date') {
    session.quoteDate = parseDate(trimmed)
    session.step = 'items'
    await sendMessage(
      chatId,
      `📋 Fecha: <b>${session.quoteDate}</b>\n\nAhora agrega los ítems uno por uno con este formato:\n\n<code>nombre | cantidad | unidad | precio sin IVA</code>\n\nEjemplos:\n<code>Madera MDF 18mm | 10 | láminas | 85000</code>\n<code>Tornillos 2" | 100 | und | 200</code>\n\nCuando termines, escribe <b>listo</b>`
    )

  } else if (session.step === 'items') {
    if (trimmed.toLowerCase() === 'listo') {
      if (session.items.length === 0) {
        await sendMessage(chatId, '⚠️ Debes agregar al menos un ítem. Envía el primer ítem o escribe /cancelar.')
        return
      }
      session.step = 'confirm'
      const subtotal = session.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const itemLines = session.items.map((i, idx) =>
        `${idx + 1}. ${i.name} — ${i.quantity} ${i.unit} — ${formatCOP(i.unitPrice)}/${i.unit} = ${formatCOP(i.quantity * i.unitPrice)}`
      ).join('\n')
      const summary =
        `📋 <b>Resumen de la cotización</b>\n\n` +
        `🏢 Proveedor: <b>${session.supplierName}</b>${session.supplierNit ? ` (NIT: ${session.supplierNit})` : ''}\n` +
        `📅 Fecha: ${session.quoteDate}\n\n` +
        `<b>Ítems (${session.items.length}):</b>\n${itemLines}\n\n` +
        `💰 <b>Subtotal sin IVA: ${formatCOP(subtotal)}</b>\n\n` +
        `¿Guardamos esta cotización?`
      await sendMessage(chatId, summary, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Guardar', callback_data: 'manual_confirm' },
            { text: '❌ Cancelar', callback_data: 'manual_cancel' },
          ]],
        },
      })
    } else {
      const item = parseItem(trimmed)
      if (!item) {
        await sendMessage(
          chatId,
          '⚠️ Formato incorrecto. Usa:\n<code>nombre | cantidad | unidad | precio</code>\n\nEj: <code>Madera MDF | 10 | láminas | 85000</code>\n\nO escribe <b>listo</b> para terminar.'
        )
        return
      }
      // Save pending item and ask for category
      session.pendingItem = item
      session.step = 'item_category'
      await sendCategoryKeyboard(
        chatId,
        `✅ <b>${item.name}</b> — ${item.quantity} ${item.unit} — ${formatCOP(item.unitPrice)}/${item.unit}\n\n📂 ¿A qué categoría pertenece este ítem?`,
        'item_cat'
      )
    }
  }
}

async function saveManualQuote(chatId: number | string, session: Session): Promise<string | null> {
  const supabase = createServiceClient()

  let supplierId: string
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .ilike('name', session.supplierName)
    .maybeSingle()

  if (existing) {
    supplierId = existing.id
  } else {
    const { data: newSupplier, error } = await supabase
      .from('suppliers')
      .insert({
        name: session.supplierName,
        notes: session.supplierNit ? `NIT: ${session.supplierNit}` : null,
      })
      .select('id')
      .single()
    if (error || !newSupplier) return null
    supplierId = newSupplier.id
  }

  const subtotal = session.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  const { data: quote, error: quoteError } = await supabase
    .from('supplier_quotes')
    .insert({
      supplier_id: supplierId,
      quote_date: session.quoteDate,
      currency: 'COP',
      status: 'pending',
      source: 'telegram',
      subtotal_before_iva: subtotal,
    })
    .select('id')
    .single()

  if (quoteError || !quote) return null

  const itemRows = session.items.map(item => ({
    supplier_quote_id: quote.id,
    supplier_id: supplierId,
    category_id: item.categoryId || null,
    product_name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_price_before_iva: item.unitPrice,
    total_before_iva: item.quantity * item.unitPrice,
    is_approved: false,
    quote_date: session.quoteDate,
  }))

  const { data: savedItems, error: itemsError } = await supabase
    .from('supplier_quote_items')
    .insert(itemRows)
    .select('id')

  if (itemsError) return null

  await supabase.from('supplier_quotes').update({ status: 'approved' }).eq('id', quote.id)
  const itemIds = (savedItems || []).map(i => i.id)
  if (itemIds.length > 0) {
    await supabase.from('supplier_quote_items').update({ is_approved: true, priority: 1 }).in('id', itemIds)
  }

  return quote.id
}

// ─── PDF flow ─────────────────────────────────────────────────────────────────

interface ParsedQuote {
  supplier_name: string | null
  supplier_nit: string | null
  supplier_email: string | null
  supplier_phone: string | null
  supplier_city: string | null
  supplier_contact: string | null
  quote_reference: string | null
  quote_date: string | null
  expiry_date: string | null
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  iva_included: 'yes' | 'no' | 'unknown'
  items: Array<{
    product_name: string
    description: string | null
    quantity: number
    unit: string
    unit_price_before_iva: number
    total_before_iva: number
  }>
}

async function handlePdfDocument(chatId: number | string, fileId: string) {
  await sendMessage(chatId, '📄 Analizando cotización con IA… un momento.')

  const fileInfoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  const fileInfo = await fileInfoRes.json()
  const filePath: string = fileInfo?.result?.file_path
  if (!filePath) { await sendMessage(chatId, '❌ No pude descargar el archivo. Inténtalo de nuevo.'); return }

  const fileRes = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${filePath}`)
  const pdfBytes = await fileRes.arrayBuffer()
  const base64 = Buffer.from(pdfBytes).toString('base64')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pricing-management-three.vercel.app'
  let parsed: ParsedQuote
  try {
    const parseRes = await fetch(`${appUrl}/api/quotes/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64 }),
    })
    if (!parseRes.ok) throw new Error(`parse error ${parseRes.status}`)
    parsed = await parseRes.json()
  } catch {
    await sendMessage(chatId, '❌ Error al analizar el PDF con IA. Inténtalo desde la web app.')
    return
  }

  if (!parsed.items?.length) {
    await sendMessage(chatId, '❌ No pude extraer ítems de este PDF. Inténtalo desde la web app.')
    return
  }

  // Save to Supabase
  const supabase = createServiceClient()
  const supplierName = parsed.supplier_name || 'Proveedor desconocido'

  let supplierId: string
  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id')
    .ilike('name', supplierName)
    .maybeSingle()

  if (existingSupplier) {
    supplierId = existingSupplier.id
  } else {
    const { data: newSupplier, error } = await supabase
      .from('suppliers')
      .insert({
        name: supplierName,
        contact_name: parsed.supplier_contact || null,
        email: parsed.supplier_email || null,
        phone: parsed.supplier_phone || null,
        city: parsed.supplier_city || null,
        notes: parsed.supplier_nit ? `NIT: ${parsed.supplier_nit}` : null,
      })
      .select('id')
      .single()
    if (error || !newSupplier) { await sendMessage(chatId, '❌ Error al guardar el proveedor.'); return }
    supplierId = newSupplier.id
  }

  const subtotal = parsed.items.reduce((s, i) => s + i.total_before_iva, 0)
  const ivaAmount = parsed.iva_amount ?? (parsed.iva_included !== 'yes' ? subtotal * 0.19 : null)
  const totalWithIva = parsed.total_with_iva ?? (ivaAmount != null ? subtotal + ivaAmount : null)
  const quoteDate = parsed.quote_date || new Date().toISOString().split('T')[0]

  const { data: quote, error: quoteError } = await supabase
    .from('supplier_quotes')
    .insert({
      supplier_id: supplierId,
      quote_reference: parsed.quote_reference,
      quote_date: quoteDate,
      expiry_date: parsed.expiry_date,
      currency: 'COP',
      status: 'pending',
      source: 'telegram',
      subtotal_before_iva: parsed.subtotal_before_iva ?? subtotal,
      iva_amount: ivaAmount,
      total_with_iva: totalWithIva,
    })
    .select('id')
    .single()

  if (quoteError || !quote) { await sendMessage(chatId, '❌ Error al guardar la cotización.'); return }

  await supabase.from('supplier_quote_items').insert(
    parsed.items.map(item => ({
      supplier_quote_id: quote.id,
      supplier_id: supplierId,
      product_name: item.product_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_before_iva: item.unit_price_before_iva,
      total_before_iva: item.total_before_iva,
      is_approved: false,
      quote_date: quoteDate,
    }))
  )

  // Build summary text
  const displayItems = parsed.items.slice(0, 8)
  const more = parsed.items.length > 8 ? `\n… y ${parsed.items.length - 8} más` : ''
  const itemLines = displayItems.map((item, i) =>
    `${i + 1}. ${item.product_name} — ${item.quantity} ${item.unit} — ${formatCOP(item.unit_price_before_iva)}/${item.unit}`
  ).join('\n')

  const summaryText =
    `📋 <b>Cotización: ${supplierName}</b>\n` +
    `${parsed.items.length} ítems • ${quoteDate}\n\n` +
    `${itemLines}${more}\n\n` +
    `💰 Subtotal (sin IVA): <b>${formatCOP(subtotal)}</b>` +
    (ivaAmount != null ? `\nIVA: ${formatCOP(ivaAmount)}` : '') +
    (totalWithIva != null ? `\nTotal: <b>${formatCOP(totalWithIva)}</b>` : '')

  // Store pending quote and ask for category
  pendingPdfCategory.set(chatId, {
    quoteId: quote.id,
    supplierName,
    itemCount: parsed.items.length,
    summaryText,
  })

  await sendCategoryKeyboard(
    chatId,
    `${summaryText}\n\n📂 <b>¿A qué categoría pertenecen estos materiales?</b>`,
    'pdf_cat'
  )
}

// ─── Materials query ──────────────────────────────────────────────────────────

async function handleMaterialsQuery(chatId: number | string, query?: string) {
  const supabase = createServiceClient()

  let dbQuery = supabase
    .from('supplier_quote_items')
    .select(`
      product_name,
      unit_price_before_iva,
      unit,
      priority,
      supplier:suppliers(name),
      quote:supplier_quotes(quote_date, expiry_date)
    `)
    .eq('is_approved', true)
    .order('product_name')
    .order('priority')
    .limit(100)

  if (query) {
    dbQuery = dbQuery.ilike('product_name', `%${query}%`)
  }

  const { data: materials } = await dbQuery

  if (!materials || materials.length === 0) {
    const msg = query
      ? `❌ No encontré materiales que coincidan con "<b>${query}</b>".`
      : '📦 No hay materiales registrados aún. Sube una cotización para empezar.'
    await sendMessage(chatId, msg)
    return
  }

  const seen = new Set<string>()
  const unique = materials.filter(m => {
    if (seen.has(m.product_name)) return false
    seen.add(m.product_name)
    return true
  }).slice(0, 20)

  const lines = unique.map(m => {
    const sup = (m.supplier as { name: string } | null)?.name || ''
    return `• <b>${m.product_name}</b> — ${formatCOP(m.unit_price_before_iva)}/${m.unit}${sup ? ` (${sup})` : ''}`
  }).join('\n')

  const header = query
    ? `🔍 <b>Materiales: "${query}"</b> (${unique.length} resultado${unique.length !== 1 ? 's' : ''})\n\n`
    : `📦 <b>Materiales disponibles</b> (${unique.length}${materials.length > 20 ? '+' : ''} resultados)\n\n`

  await sendMessage(chatId, header + lines)
}

async function handleTextMessage(chatId: number | string, text: string) {
  const supabase = createServiceClient()

  const { data: materials } = await supabase
    .from('supplier_quote_items')
    .select(`
      product_name,
      unit_price_before_iva,
      unit,
      supplier:suppliers(name),
      quote:supplier_quotes(quote_date)
    `)
    .eq('is_approved', true)
    .order('product_name')
    .order('priority')
    .limit(150)

  const materialsContext =
    materials && materials.length > 0
      ? materials
          .map(m => {
            const sup = (m.supplier as { name: string } | null)?.name || ''
            const date = (m.quote as { quote_date: string } | null)?.quote_date || ''
            return `- ${m.product_name}: ${formatCOP(m.unit_price_before_iva)}/${m.unit}${sup ? ` — proveedor: ${sup}` : ''}${date ? ` — cotizado: ${date}` : ''}`
          })
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
          'Responde siempre en español, de forma concisa. ' +
          'Todos los precios son en COP (pesos colombianos). ' +
          'Si el usuario pregunta cómo agregar cotizaciones, diles que pueden enviar un PDF o escribir /nueva. ' +
          'Si preguntan por un material que no está en la lista, díselo claramente.\n\n' +
          `<materiales_actuales>\n${materialsContext}\n</materiales_actuales>`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.5,
    max_tokens: 600,
  })

  const reply = response.choices[0]?.message?.content?.trim() || 'No pude generar una respuesta. Inténtalo de nuevo.'
  await sendMessage(chatId, reply)
}

// ─── Callback query handler ───────────────────────────────────────────────────

async function handleCallbackQuery(
  callbackQueryId: string,
  chatId: number | string,
  messageId: number,
  data: string
) {
  const supabase = createServiceClient()

  // ── Item category selection (manual flow) ──
  if (data.startsWith('item_cat:')) {
    const session = sessions.get(chatId as number)
    if (!session || session.flow !== 'manual' || !session.pendingItem) {
      await answerCallbackQuery(callbackQueryId, 'Sesión expirada')
      return
    }
    const catId = data.replace('item_cat:', '')
    const categoryId = catId === 'skip' ? null : catId

    const item: ManualItem = { ...session.pendingItem, categoryId }
    session.items.push(item)
    session.pendingItem = null
    session.step = 'items'

    const runningTotal = session.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const catLabel = catId === 'skip' ? 'sin categoría' : '✓ categoría asignada'
    await answerCallbackQuery(callbackQueryId, '✅ Categoría guardada')
    await editMessageText(
      chatId, messageId,
      `✅ <b>${item.name}</b> — ${item.quantity} ${item.unit} — ${formatCOP(item.unitPrice)}/${item.unit} (${catLabel})\n\n` +
      `Total acumulado: ${formatCOP(runningTotal)} (${session.items.length} ítem${session.items.length !== 1 ? 's' : ''})\n\nAgrega otro ítem o escribe <b>listo</b>`
    )
    return
  }

  // ── PDF category selection ──
  if (data.startsWith('pdf_cat:')) {
    const pending = pendingPdfCategory.get(chatId)
    if (!pending) {
      await answerCallbackQuery(callbackQueryId, 'Sesión expirada')
      return
    }
    const catId = data.replace('pdf_cat:', '')
    const categoryId = catId === 'skip' ? null : catId

    // Apply category to all items of this quote
    if (categoryId) {
      await supabase
        .from('supplier_quote_items')
        .update({ category_id: categoryId })
        .eq('supplier_quote_id', pending.quoteId)
    }

    pendingPdfCategory.delete(chatId)
    await answerCallbackQuery(callbackQueryId, '✅ Categoría asignada')

    const catLabel = catId === 'skip' ? '' : ' • categoría asignada ✓'
    await editMessageText(
      chatId, messageId,
      `${pending.summaryText}${catLabel}\n\n¿Apruebo y guardo esta cotización?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Aprobar', callback_data: `approve:${pending.quoteId}` },
            { text: '❌ Descartar', callback_data: `reject:${pending.quoteId}` },
          ]],
        },
      }
    )
    return
  }

  // ── Manual quote: confirm ──
  if (data === 'manual_confirm') {
    await answerCallbackQuery(callbackQueryId, 'Guardando…')
    const session = sessions.get(chatId as number)
    if (!session || session.flow !== 'manual') {
      await editMessageText(chatId, messageId, '❌ Sesión expirada. Escribe /nueva para empezar.')
      return
    }
    const quoteId = await saveManualQuote(chatId, session)
    sessions.delete(chatId as number)
    if (!quoteId) {
      await editMessageText(chatId, messageId, '❌ Error al guardar la cotización. Inténtalo de nuevo.')
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      await editMessageText(
        chatId, messageId,
        `✅ <b>Cotización guardada y aprobada</b>\n\nProveedor: ${session.supplierName}\n${session.items.length} ítems guardados.\n\nVer en la app: ${appUrl}/supplier-quotes/${quoteId}`
      )
    }
    return
  }

  // ── Manual quote: cancel ──
  if (data === 'manual_cancel') {
    await answerCallbackQuery(callbackQueryId, 'Cancelado')
    sessions.delete(chatId as number)
    await editMessageText(chatId, messageId, '❌ Cotización cancelada.')
    return
  }

  // ── PDF quote: approve ──
  if (data.startsWith('approve:')) {
    const quoteId = data.replace('approve:', '')
    const { data: items, error: itemsErr } = await supabase
      .from('supplier_quote_items')
      .select('id')
      .eq('supplier_quote_id', quoteId)

    if (itemsErr) { await answerCallbackQuery(callbackQueryId, 'Error'); return }

    const itemIds = (items || []).map(i => i.id)
    await supabase.from('supplier_quotes').update({ status: 'approved' }).eq('id', quoteId)
    if (itemIds.length > 0) {
      await supabase.from('supplier_quote_items').update({ is_approved: true, priority: 1 }).in('id', itemIds)
    }

    await answerCallbackQuery(callbackQueryId, 'Cotización aprobada ✅')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    await editMessageText(
      chatId, messageId,
      `✅ <b>Cotización aprobada</b>\n\nLos materiales ya están disponibles en la sección de Materiales.\n\nVer: ${appUrl}/supplier-quotes/${quoteId}`,
    )
    return
  }

  // ── PDF quote: reject ──
  if (data.startsWith('reject:')) {
    const quoteId = data.replace('reject:', '')
    const { data: items } = await supabase.from('supplier_quote_items').select('id').eq('supplier_quote_id', quoteId)
    const itemIds = (items || []).map(i => i.id)
    if (itemIds.length > 0) {
      await supabase.from('product_recipes').delete().in('supplier_quote_item_id', itemIds)
      await supabase.from('supplier_quote_items').delete().in('id', itemIds)
    }
    await supabase.from('supplier_quotes').delete().eq('id', quoteId)
    pendingPdfCategory.delete(chatId)
    await answerCallbackQuery(callbackQueryId, 'Cotización descartada')
    await editMessageText(chatId, messageId, '🗑️ Cotización descartada y eliminada.')
    return
  }

  await answerCallbackQuery(callbackQueryId)
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: Record<string, unknown>
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    if (update.callback_query) {
      const cq = update.callback_query as {
        id: string; data: string
        message: { chat: { id: number }; message_id: number }
      }
      await handleCallbackQuery(cq.id, cq.message.chat.id, cq.message.message_id, cq.data)
      return NextResponse.json({ ok: true })
    }

    if (update.message) {
      const message = update.message as {
        chat: { id: number }
        document?: { file_id: string; mime_type: string }
        text?: string
      }
      const chatId = message.chat.id

      if (message.document?.mime_type === 'application/pdf') {
        sessions.delete(chatId)
        pendingPdfCategory.delete(chatId)
        await handlePdfDocument(chatId, message.document.file_id)
        return NextResponse.json({ ok: true })
      }

      if (message.document) {
        await sendMessage(chatId, '⚠️ Solo acepto archivos PDF. Envía el PDF de la cotización.')
        return NextResponse.json({ ok: true })
      }

      if (message.text) {
        const text = message.text.trim()

        if (text === '/start') { await sendMessage(chatId, HELP_TEXT); return NextResponse.json({ ok: true }) }
        if (text === '/ayuda' || text === '/help') { await sendMessage(chatId, HELP_TEXT); return NextResponse.json({ ok: true }) }
        if (text === '/nueva') { await startManualFlow(chatId); return NextResponse.json({ ok: true }) }
        if (text.startsWith('/materiales')) {
          const query = text.replace('/materiales', '').trim()
          await handleMaterialsQuery(chatId, query || undefined)
          return NextResponse.json({ ok: true })
        }

        const session = sessions.get(chatId)
        if (session?.flow === 'manual') {
          await handleManualStep(chatId, text, session)
          return NextResponse.json({ ok: true })
        }

        await handleTextMessage(chatId, text)
        return NextResponse.json({ ok: true })
      }
    }
  } catch (err) {
    console.error('Telegram webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}
