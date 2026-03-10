/**
 * Extrae texto de un PDF usando pdf-parse.
 * Importamos desde /lib/ directamente para evitar el error ENOENT en producción
 * (pdf-parse intenta leer un archivo de test en su entry point principal).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js")
  const data = await pdfParse(buffer)
  return data.text as string
}
