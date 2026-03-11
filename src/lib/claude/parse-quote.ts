import OpenAI from "openai"
import type { ParsedQuoteDocument } from "@/types"
import { extractPdfText } from "@/lib/pdf/extract-text"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PARSE_PROMPT = `Eres un experto en extracción de datos de cotizaciones de proveedores de materiales de interiorismo y mobiliario en Colombia.

PASO 1 — ANALIZA LA ESTRUCTURA DE LA TABLA:
Antes de extraer datos, identifica qué columna representa cada concepto:
- CANTIDAD DEL PEDIDO: columna que indica cuántas unidades del producto se están cotizando (ej: "Cantidad", "Und", "Cant."). NO la confundas con columnas de especificaciones como "cantidad de tela", "metros de material", "medida".
- PRECIO UNITARIO: precio por una unidad del producto (ej: "Precio unitario", "V/r. x Unidad", "Valor unit.").
- TOTAL DE LA FILA: precio unitario × cantidad del pedido (ej: "Total", "V/R. Total", "Subtotal fila").

PASO 2 — DETECTA EL TRATAMIENTO DEL IVA:
- Si el documento dice "PRECIO INCLUYE IVA", "IVA incluido" o similar → precios YA incluyen IVA. Divide por 1.19 para obtener precio sin IVA.
- Si el IVA aparece como línea separada al final del documento → precios son SIN IVA.
- Si no es claro → usa "unknown".

PASO 3 — EXTRAE CADA ÍTEM:
- Una descripción puede ocupar múltiples líneas pero es UN SOLO ítem.
- Solo crea un ítem nuevo cuando haya un nuevo conjunto de (cantidad del pedido + precio unitario + total).
- Ignora columnas de especificaciones (imágenes, número de artículo, medidas de materiales, telas).
- product_name: nombre completo del producto (todas las líneas de descripción del ítem)
- description: especificaciones clave (medidas del mueble, materiales, acabados)
- quantity: CANTIDAD DEL PEDIDO — número de unidades a comprar
- unit: unidad (unidad, metro, m2, kg, rollo, lámina, etc.)
- unit_price_before_iva: precio unitario SIN IVA en COP
- total_before_iva: quantity × unit_price_before_iva

Datos del proveedor (encabezado del documento):
- supplier_name: nombre completo de la empresa proveedora (razón social, ej: "FRENCHER SERVICIOS INDUSTRIALES S.A.S")
- supplier_nit: NIT o RUT de la empresa (ej: "900123456-7"). Solo el número, sin "NIT" ni "RUT".
- supplier_email: correo electrónico del proveedor si aparece en el documento.
- supplier_phone: teléfono o celular del proveedor si aparece en el documento.
- supplier_city: ciudad del proveedor si aparece (ej: "Bogotá", "Medellín").
- supplier_contact: nombre de la persona de contacto si aparece.

Datos de la cotización:
- quote_reference, quote_date (YYYY-MM-DD o null), expiry_date (YYYY-MM-DD o null)
- subtotal_before_iva, iva_amount, total_with_iva (números en COP)
- iva_included: "yes" / "no" / "unknown"

Todos los valores monetarios son números puros sin puntos ni comas de formato.`

// JSON Schema estricto — garantiza estructura exacta sin campos inventados
const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    supplier_name: { type: ["string", "null"] },
    supplier_nit: { type: ["string", "null"] },
    supplier_email: { type: ["string", "null"] },
    supplier_phone: { type: ["string", "null"] },
    supplier_city: { type: ["string", "null"] },
    supplier_contact: { type: ["string", "null"] },
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
  required: ["supplier_name", "supplier_nit", "supplier_email", "supplier_phone", "supplier_city", "supplier_contact", "quote_reference", "quote_date", "expiry_date", "subtotal_before_iva", "iva_amount", "total_with_iva", "iva_included", "items"],
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
