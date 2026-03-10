import OpenAI from "openai"
import type { ParsedQuoteDocument } from "@/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PARSE_PROMPT = `Eres un asistente que extrae datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

Para cada ítem de la tabla extrae:
- product_name: nombre completo del producto/material
- description: especificaciones (medida, acabado, color, referencia)
- quantity: cantidad (número)
- unit: unidad (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP (número)
- total_before_iva: total de esa fila en COP (número)

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

const RETRY_PROMPT = (subtotalDoc: number, subtotalParsed: number) =>
  `Revisaste mal los ítems. La suma de los totales que extrajiste es ${subtotalParsed.toLocaleString("es-CO")}, pero el subtotal que aparece en el documento es ${subtotalDoc.toLocaleString("es-CO")}. Hay una discrepancia de ${Math.abs(subtotalDoc - subtotalParsed).toLocaleString("es-CO")}.

Vuelve a leer el documento con cuidado. Es probable que hayas confundido columnas de la tabla (cantidad, precio unitario o total). Para cada fila, el valor total impreso en el documento es la fuente de verdad — úsalo para verificar que quantity × unit_price = total_before_iva.

Responde SOLO con JSON válido, sin texto adicional, sin markdown.`

function sumItemTotals(parsed: ParsedQuoteDocument): number {
  return (parsed.items ?? []).reduce((sum, item) => sum + (item.total_before_iva ?? 0), 0)
}

function parseJson(raw: string): ParsedQuoteDocument {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("No se pudo extraer JSON de la respuesta de OpenAI")
  return JSON.parse(match[0]) as ParsedQuoteDocument
}

export async function parseQuotePDF(pdfBase64: string): Promise<ParsedQuoteDocument> {
  const fileContent = {
    type: "file" as const,
    file: {
      filename: "cotizacion.pdf",
      file_data: `data:application/pdf;base64,${pdfBase64}`,
    },
  }

  // Primera pasada
  const first = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [fileContent as any, { type: "text", text: PARSE_PROMPT }],
      },
    ],
  })

  const parsed = parseJson(first.choices[0]?.message?.content ?? "")

  // Validar contra subtotal del documento
  const subtotalDoc = parsed.subtotal_before_iva
  if (subtotalDoc && subtotalDoc > 0) {
    const subtotalParsed = sumItemTotals(parsed)
    const diff = Math.abs(subtotalDoc - subtotalParsed) / subtotalDoc

    if (diff > 0.03) {
      // Más de 3% de diferencia → reintentar con feedback
      const retry = await openai.chat.completions.create({
        model: "gpt-4.1",
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [fileContent as any, { type: "text", text: PARSE_PROMPT }],
          },
          { role: "assistant", content: first.choices[0]?.message?.content ?? "" },
          { role: "user", content: RETRY_PROMPT(subtotalDoc, subtotalParsed) },
        ],
      })
      return parseJson(retry.choices[0]?.message?.content ?? "")
    }
  }

  return parsed
}

export async function parseQuoteText(text: string): Promise<ParsedQuoteDocument> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `${PARSE_PROMPT}\n\nDocumento a analizar:\n${text}`,
      },
    ],
  })

  return parseJson(response.choices[0]?.message?.content ?? "")
}
