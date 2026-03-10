export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { Bot } from "grammy"
import { createServiceClient } from "@/lib/supabase/server"
import { formatCOP } from "@/lib/pricing"

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) console.warn("TELEGRAM_BOT_TOKEN no configurado")

let bot: Bot | null = null

function getBot() {
  if (!bot && token) {
    bot = new Bot(token)
    setupBot(bot)
  }
  return bot
}

function setupBot(bot: Bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "👋 Bienvenido a *Acme Estudio*\n\n" +
      "Puedo ayudarte a:\n" +
      "• Analizar cotizaciones de proveedores (envía un PDF)\n" +
      "• Consultar precios de materiales\n" +
      "• Ver costos de productos\n\n" +
      "Usa /ayuda para ver todos los comandos.",
      { parse_mode: "Markdown" }
    )
  })

  bot.command("ayuda", async (ctx) => {
    await ctx.reply(
      "📋 *Comandos disponibles:*\n\n" +
      "/precio <material> — Consultar precio de un material\n" +
      "/producto <nombre> — Ver costo y precio de venta\n" +
      "/comparar <material> — Comparar proveedores\n" +
      "/ayuda — Esta ayuda\n\n" +
      "También puedes enviarme un PDF de cotización y lo analizaré automáticamente.",
      { parse_mode: "Markdown" }
    )
  })

  bot.command("precio", async (ctx) => {
    const materialName = ctx.match
    if (!materialName) {
      await ctx.reply("Uso: /precio <nombre del material>\nEjemplo: /precio madera roble")
      return
    }

    const supabase = createServiceClient()
    const { data } = await supabase
      .from("supplier_quote_items")
      .select("*, supplier:suppliers(name)")
      .ilike("product_name", `%${materialName}%`)
      .eq("is_approved", true)
      .order("priority")
      .limit(5)

    if (!data?.length) {
      await ctx.reply(`No encontré cotizaciones para "${materialName}". Sube una cotización primero.`)
      return
    }

    const lines = data.map((item) => {
      const priorityEmoji = item.priority === 1 ? "🟢" : item.priority === 2 ? "🟡" : "🔴"
      const supplierName = (item.supplier as { name: string } | null)?.name || "Desconocido"
      return `${priorityEmoji} P${item.priority || "?"} — ${supplierName}: ${formatCOP(item.unit_price_before_iva)}/${item.unit}`
    })

    await ctx.reply(
      `💰 *Precios de ${materialName}:*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    )
  })

  bot.command("producto", async (ctx) => {
    const productName = ctx.match
    if (!productName) {
      await ctx.reply("Uso: /producto <nombre del producto>\nEjemplo: /producto mesa comedor")
      return
    }

    const supabase = createServiceClient()
    const { data } = await supabase
      .from("sellable_products")
      .select("*")
      .ilike("name", `%${productName}%`)
      .eq("is_active", true)
      .limit(3)

    if (!data?.length) {
      await ctx.reply(`No encontré el producto "${productName}".`)
      return
    }

    const product = data[0]
    const msg = [
      `📦 *${product.name}*`,
      ``,
      `Costo producción: ${formatCOP(product.production_cost)}`,
      `Costo total: ${formatCOP(product.total_cost)}`,
      `Margen: ${product.margin_percentage}%`,
      `Precio sin IVA: ${formatCOP(product.sale_price_before_iva)}`,
      `IVA (${product.iva_percentage}%): ${formatCOP(product.iva_amount)}`,
      `*Precio final: ${formatCOP(product.sale_price_with_iva)}*`,
      `Ganancia: ${formatCOP(product.profit_per_unit)}`,
    ].join("\n")

    await ctx.reply(msg, { parse_mode: "Markdown" })
  })

  // Manejar PDFs enviados por el usuario
  bot.on(":document", async (ctx) => {
    const doc = ctx.message?.document
    if (!doc || doc.mime_type !== "application/pdf") {
      await ctx.reply("Por favor envía un archivo PDF de cotización.")
      return
    }

    await ctx.reply("📄 Analizando cotización con IA... un momento.")

    try {
      const fileInfo = await ctx.api.getFile(doc.file_id)
      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`

      const fileResponse = await fetch(fileUrl)
      const blob = await fileResponse.blob()

      const formData = new FormData()
      formData.append("file", blob, "cotizacion.pdf")

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const parseResponse = await fetch(`${appUrl}/api/quotes/parse`, {
        method: "POST",
        body: formData,
      })

      if (!parseResponse.ok) throw new Error("Error al parsear")

      const parsed = await parseResponse.json()
      const items = parsed.items || []

      if (!items.length) {
        await ctx.reply("No pude extraer ítems de este PDF. Intenta con la web app.")
        return
      }

      const supplierName = parsed.supplier_name || "Desconocido"
      const dateStr = parsed.quote_date || new Date().toLocaleDateString("es-CO")

      const itemLines = items.slice(0, 10).map((item: {
        product_name: string
        quantity: number
        unit: string
        unit_price_before_iva: number
        total_before_iva: number
      }, i: number) =>
        `${i + 1}. ${item.product_name} — ${item.quantity}${item.unit} — ${formatCOP(item.unit_price_before_iva)}/${item.unit} — ${formatCOP(item.total_before_iva)}`
      ).join("\n")

      const more = items.length > 10 ? `\n... y ${items.length - 10} más` : ""

      await ctx.reply(
        `📋 *Detecté ${items.length} ítems del proveedor ${supplierName}:*\n\n${itemLines}${more}\n\nPrecios SIN IVA. Fecha: ${dateStr}\n\n_Para registrar, usa la web app: ${process.env.NEXT_PUBLIC_APP_URL}_`,
        { parse_mode: "Markdown" }
      )
    } catch (err) {
      console.error("Error handling PDF:", err)
      await ctx.reply("Ocurrió un error al analizar el PDF. Inténtalo desde la web app.")
    }
  })
}

export async function POST(request: Request) {
  // Verificar secret
  const secret = request.headers.get("x-telegram-bot-api-secret-token")
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentBot = getBot()
  if (!currentBot) {
    return NextResponse.json({ error: "Bot no configurado" }, { status: 500 })
  }

  try {
    const update = await request.json()
    await currentBot.handleUpdate(update)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Telegram webhook error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
