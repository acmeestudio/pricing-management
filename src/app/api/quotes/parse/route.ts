export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { parseQuoteImages, parseQuoteText, parseQuotePDF } from "@/lib/claude/parse-quote"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""

    // Flujo web: imágenes PNG renderizadas en el browser
    if (contentType.includes("application/json")) {
      const { images } = await request.json() as { images?: string[] }
      if (!images?.length) {
        return NextResponse.json({ error: "No se enviaron imágenes" }, { status: 400 })
      }
      const parsed = await parseQuoteImages(images)
      return NextResponse.json(parsed)
    }

    // Flujo Telegram: FormData con PDF o texto
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const text = formData.get("text") as string | null

    if (!file && !text) {
      return NextResponse.json({ error: "Se requiere imágenes, archivo PDF o texto" }, { status: 400 })
    }

    let parsed
    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      parsed = await parseQuotePDF(base64)
    } else {
      parsed = await parseQuoteText(text!)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error("Error parsing quote:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al procesar el documento" },
      { status: 500 }
    )
  }
}
