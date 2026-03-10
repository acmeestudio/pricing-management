export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createServiceClient } from "@/lib/supabase/server"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PARSE_PROMPT = `Eres un asistente que extrae datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

Analiza el documento y extrae TODOS los ítems. Si un producto aparece con diferentes cantidades, medidas o materiales, cada variante es un ítem SEPARADO.

Para cada ítem extrae:
- product_name: nombre del producto/material
- description: especificaciones (medida, acabado, color, referencia)
- quantity: cantidad (número)
- unit: unidad (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP (número)
- total_before_iva: quantity × unit_price_before_iva (número)

Datos generales del documento:
- supplier_name: nombre del proveedor
- quote_reference: número de cotización
- quote_date: fecha en formato YYYY-MM-DD (o null si no aparece)
- expiry_date: fecha de vigencia en formato YYYY-MM-DD (o null)
- subtotal_before_iva: subtotal sin IVA (número o null)
- iva_amount: monto del IVA (número o null)
- total_with_iva: total con IVA (número o null)
- iva_included: "yes" si los precios incluyen IVA, "no" si no incluyen, "unknown" si no es claro

Si los precios incluyen IVA 19%, calcula el valor sin IVA dividiendo por 1.19.
Todos los valores monetarios deben ser números, no strings con formato.

Responde SOLO con JSON válido, sin texto adicional, sin markdown.`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const text = formData.get("text") as string | null

    if (!file && !text) {
      return NextResponse.json({ error: "Se requiere un archivo PDF o texto" }, { status: 400 })
    }

    let documentText = text ?? ""

    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = ((await import("pdf-parse")) as any).default ?? (await import("pdf-parse"))
      const pdfData = await pdfParse(buffer)
      documentText = pdfData.text
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${PARSE_PROMPT}\n\nDocumento a analizar:\n${documentText}`,
        },
      ],
    })

    const rawText = response.choices[0]?.message?.content ?? ""

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo extraer JSON de la respuesta" }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error) {
    console.error("Error parsing quote:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al procesar el documento" },
      { status: 500 }
    )
  }
}
