/**
 * Extrae texto de un PDF preservando la estructura de tablas.
 * Usa pdfjs-dist para obtener coordenadas X,Y de cada fragmento de texto
 * y agrupa por filas (mismo Y) ordenando por X para reconstruir columnas.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdf = await loadingTask.promise
  let fullText = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Agrupar fragmentos por fila (coordenada Y redondeada al múltiplo de 3)
    const rows = new Map<number, { x: number; text: string }[]>()

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const typedItem = item as { transform: number[]; str: string }
      // transform[5] = Y (crece hacia arriba en PDF), transform[4] = X
      const y = Math.round(typedItem.transform[5] / 3) * 3
      const x = typedItem.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, text: typedItem.str.trim() })
    }

    // Ordenar filas: Y descendente (la primera línea del PDF tiene Y más alto)
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
