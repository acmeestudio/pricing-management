import OpenAI from "openai"
import type { ParsedQuoteDocument } from "@/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PARSE_PROMPT = `Eres un asistente que extrae datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

INSTRUCCIONES CRÍTICAS PARA LEER LA TABLA:
1. Lee la tabla fila por fila, de arriba hacia abajo.
2. Para cada fila, mantén los valores EXACTAMENTE en la misma fila. NUNCA mezcles valores de filas diferentes.
3. Identifica las columnas: descripción del producto, cantidad, precio unitario, total.
4. VERIFICA que quantity × unit_price = total para cada fila. Si no coincide, revisa cuál columna leíste mal.
5. Usa el total de la fila como referencia para validar cantidad y precio unitario.

Para cada ítem extrae:
- product_name: nombre del producto/material
- description: especificaciones (medida, acabado, color, referencia)
- quantity: cantidad (número) — verifica con: total / unit_price = quantity
- unit: unidad (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP (número) — verifica con: total / quantity = unit_price
- total_before_iva: total de la fila (número) — verifica con: quantity × unit_price = total

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
Todos los valores monetarios deben ser números, sin puntos ni comas de formato.

Responde SOLO con JSON válido, sin texto adicional, sin markdown.`

export async function parseQuotePDF(pdfBase64: string): Promise<ParsedQuoteDocument> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: "cotizacion.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
          } as never,
          {
            type: "text",
            text: PARSE_PROMPT,
          },
        ],
      },
    ],
  })

  const rawText = response.choices[0]?.message?.content ?? ""
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta de OpenAI")

  return JSON.parse(jsonMatch[0]) as ParsedQuoteDocument
}

export async function parseQuoteText(text: string): Promise<ParsedQuoteDocument> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${PARSE_PROMPT}\n\nDocumento a analizar:\n${text}`,
      },
    ],
  })

  const rawText = response.choices[0]?.message?.content ?? ""
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta de OpenAI")

  return JSON.parse(jsonMatch[0]) as ParsedQuoteDocument
}
