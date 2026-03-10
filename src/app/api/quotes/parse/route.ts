export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { parseQuotePDF, parseQuoteText } from "@/lib/claude/parse-quote"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const text = formData.get("text") as string | null

    if (!file && !text) {
      return NextResponse.json({ error: "Se requiere un archivo PDF o texto" }, { status: 400 })
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
