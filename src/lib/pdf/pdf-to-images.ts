"use client"

/**
 * Convierte cada página de un PDF a PNG base64 usando pdfjs-dist en el browser.
 * Esto evita todos los problemas de Node.js/Vercel con librerías nativas.
 */
export async function pdfToImages(file: File, scale = 2): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const images: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext("2d")!
    await page.render({ canvasContext: ctx, viewport }).promise

    // Retorna solo el base64 sin el prefijo data:image/png;base64,
    images.push(canvas.toDataURL("image/png").split(",")[1])
  }

  return images
}
