/**
 * Extrae texto de un PDF preservando la estructura de tablas.
 * Usa pdfjs-dist v2 (CommonJS, compatible con Node.js/Vercel sin DOMMatrix).
 * Agrupa fragmentos por coordenada Y para reconstruir filas de tabla.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require("pdfjs-dist/build/pdf.js")
  // Desactivar worker en entorno Node.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  let fullText = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Agrupar fragmentos de texto por fila (coordenada Y redondeada)
    const rows = new Map<number, { x: number; text: string }[]>()

    for (const item of content.items as { transform: number[]; str: string }[]) {
      if (!item.str.trim()) continue
      // transform[5] = Y (crece hacia arriba), transform[4] = X
      const y = Math.round(item.transform[5] / 3) * 3
      const x = item.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, text: item.str.trim() })
    }

    // Ordenar filas: Y descendente (parte superior de la página primero)
    const sortedRows = Array.from(rows.entries()).sort((a, b) => b[0] - a[0])

    for (const [, cells] of sortedRows) {
      const sorted = cells.sort((a, b) => a.x - b.x)
      const line = sorted.map((c) => c.text).join("  ")
      fullText += line + "\n"
    }

    fullText += "\n--- Página " + pageNum + " ---\n\n"
  }

  return fullText
}
