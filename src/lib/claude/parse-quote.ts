import OpenAI from "openai"
import type { ParsedQuoteDocument } from "@/types"
import { extractPdfText } from "@/lib/pdf/extract-text"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PARSE_PROMPT = `Eres un asistente que extrae datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

Analiza el documento y extrae TODOS los ítems. Si un producto aparece con diferentes cantidades, medidas o materiales, cada variante es un ítem SEPARADO.

Para cada ítem extrae:
- product_name: nombre completo del producto/material
- description: especificaciones (medida, acabado, color, referencia)
- quantity: cantidad (número)
- unit: unidad (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP (número)
- total_before_iva: total de esa fila (número)

Datos generales:
- supplier_name: nombre del proveedor
- quote_reference: número de cotización
- quote_date: fecha en formato YYYY-MM-DD (o null)
- expiry_date: fecha de vigencia en formato YYYY-MM-DD (o null)
- subtotal_before_iva: subtotal sin IVA del documento (número o null)
- iva_amount: monto del IVA (número o null)
- total_with_iva: total con IVA (número o null)
- iva_included: "yes" si los precios incluyen IVA, "no" si no, "unknown" si no es claro

Si los precios incluyen IVA 19%, divide por 1.19 para obtener el valor sin IVA.
Todos los valores monetarios deben ser números sin puntos ni comas de formato.

Responde SOLO con JSON válido, sin texto adicional, sin markdown.`

/** Analiza imágenes PNG (páginas del PDF renderizadas en el browser) con gpt-4o vision */
export async function parseQuoteImages(imagesBase64: string[]): Promise<ParsedQuoteDocument> {
  const imageContent = imagesBase64.map((img) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/png;base64,${img}`,
      detail: "high" as const,
    },
  }))

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [...imageContent, { type: "text", text: PARSE_PROMPT }],
      },
    ],
  })

  return JSON.parse(response.choices[0]?.message?.content ?? "") as ParsedQuoteDocument
}

/** Fallback para Telegram: extrae texto del PDF y lo analiza con gpt-4o-mini */
export async function parseQuotePDF(pdfBase64: string): Promise<ParsedQuoteDocument> {
  const buffer = Buffer.from(pdfBase64, "base64")
  const text = await extractPdfText(buffer)
  return parseQuoteText(text)
}

export async function parseQuoteText(text: string): Promise<ParsedQuoteDocument> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `${PARSE_PROMPT}\n\nDocumento a analizar:\n${text}`,
      },
    ],
  })

  return JSON.parse(response.choices[0]?.message?.content ?? "") as ParsedQuoteDocument
}
