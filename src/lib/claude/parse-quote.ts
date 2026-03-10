import Anthropic from "@anthropic-ai/sdk"
import type { ParsedQuoteDocument } from "@/types"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

export async function parseQuotePDF(pdfBase64: string): Promise<ParsedQuoteDocument> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: PARSE_PROMPT,
          },
        ],
      },
    ],
  })

  const rawText = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta de Claude")

  return JSON.parse(jsonMatch[0]) as ParsedQuoteDocument
}

export async function parseQuoteText(text: string): Promise<ParsedQuoteDocument> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${PARSE_PROMPT}\n\nDocumento a analizar:\n${text}`,
      },
    ],
  })

  const rawText = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta de Claude")

  return JSON.parse(jsonMatch[0]) as ParsedQuoteDocument
}
