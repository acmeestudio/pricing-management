export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { parseQuotePDF, parseQuoteText } from "@/lib/claude/parse-quote"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""

    // Flujo web: PDF base64 desde el browser
    if (contentType.includes("application/json")) {
      const body = await request.json() as { pdf?: string; text?: string }

      if (body.pdf) {
        const parsed = await parseQuotePDF(body.pdf)
        return NextResponse.json(parsed)
      }

      if (body.text) {
        const parsed = await parseQuoteText(body.text)
        return NextResponse.json(parsed)
      }

      return NextResponse.json({ error: "Se requiere pdf o text" }, { status: 400 })
    }

    // Flujo Telegram: FormData con PDF o texto
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const text = formData.get("text") as string | null

    if (!file && !text) {
      return NextResponse.json({ error: "Se requiere archivo PDF o texto" }, { status: 400 })
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
