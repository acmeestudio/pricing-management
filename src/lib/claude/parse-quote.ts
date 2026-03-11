import OpenAI from "openai"
import type { ParsedQuoteDocument } from "@/types"
import { extractPdfText } from "@/lib/pdf/extract-text"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PARSE_PROMPT = `Eres un asistente que extrae datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

REGLAS CRÍTICAS PARA LEER LA TABLA:
1. Cada ítem tiene exactamente una fila con números (cantidad, precio unitario, total). Esos tres valores siempre van juntos en la misma fila horizontal.
2. Una descripción de producto puede ocupar VARIAS LÍNEAS de texto consecutivas pero sigue siendo UN SOLO ítem. No crees ítems separados por líneas de texto que no tienen números asociados.
3. Solo crea un ítem nuevo cuando haya un nuevo conjunto de números (cantidad + precio + total) en la tabla.
4. Lee de izquierda a derecha: descripción → cantidad → precio unitario → total. Nunca uses los números de una fila con la descripción de otra.

Para cada ítem:
- product_name: nombre completo del producto (todas las líneas de descripción que pertenecen a ese ítem)
- description: especificaciones adicionales (medida, acabado, color, referencia), puede ser null
- quantity: cantidad numérica
- unit: unidad de medida (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP (número)
- total_before_iva: total de esa fila = quantity × unit_price_before_iva

Datos generales del documento:
- supplier_name: nombre del proveedor (string o null)
- quote_reference: número de cotización (string o null)
- quote_date: fecha en formato YYYY-MM-DD (string o null)
- expiry_date: fecha de vigencia YYYY-MM-DD (string o null)
- subtotal_before_iva: subtotal sin IVA (number o null)
- iva_amount: monto del IVA (number o null)
- total_with_iva: total con IVA (number o null)
- iva_included: "yes" si precios incluyen IVA, "no" si no incluyen, "unknown" si no es claro

Si los precios incluyen IVA 19%, divide entre 1.19 para obtener el valor sin IVA.
Todos los valores monetarios son números sin puntos ni comas de formato.`

// JSON Schema estricto — garantiza estructura exacta sin campos inventados
const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    supplier_name: { type: ["string", "null"] },
    quote_reference: { type: ["string", "null"] },
    quote_date: { type: ["string", "null"] },
    expiry_date: { type: ["string", "null"] },
    subtotal_before_iva: { type: ["number", "null"] },
    iva_amount: { type: ["number", "null"] },
    total_with_iva: { type: ["number", "null"] },
    iva_included: { type: "string", enum: ["yes", "no", "unknown"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          description: { type: ["string", "null"] },
          quantity: { type: "number" },
          unit: { type: "string" },
          unit_price_before_iva: { type: "number" },
          total_before_iva: { type: "number" },
        },
        required: ["product_name", "description", "quantity", "unit", "unit_price_before_iva", "total_before_iva"],
        additionalProperties: false,
      },
    },
  },
  required: ["supplier_name", "quote_reference", "quote_date", "expiry_date", "subtotal_before_iva", "iva_amount", "total_with_iva", "iva_included", "items"],
  additionalProperties: false,
}

/** Flujo web: PDF nativo via Responses API + JSON Schema estricto */
export async function parseQuotePDF(pdfBase64: string): Promise<ParsedQuoteDocument> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (openai as any).responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: PARSE_PROMPT },
          {
            type: "input_file",
            filename: "cotizacion.pdf",
            file_data: `data:application/pdf;base64,${pdfBase64}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "quote_extraction",
        strict: true,
        schema: QUOTE_SCHEMA,
      },
    },
  })

  const text: string = response.output_text
  return JSON.parse(text) as ParsedQuoteDocument
}

/** Fallback para Telegram: texto plano + JSON Schema estricto */
export async function parseQuoteText(text: string): Promise<ParsedQuoteDocument> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "quote_extraction",
        strict: true,
        schema: QUOTE_SCHEMA,
      },
    } as never,
    messages: [{ role: "user", content: `${PARSE_PROMPT}\n\nDocumento:\n${text}` }],
  })

  return JSON.parse(response.choices[0]?.message?.content ?? "") as ParsedQuoteDocument
}
