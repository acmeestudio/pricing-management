import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { ClientQuote } from "@/lib/supabase/types"
import { formatCOP } from "@/lib/pricing"

export function generateClientQuotePDF(quote: ClientQuote & {
  items: Array<{
    product_name: string
    description: string | null
    quantity: number
    unit: string
    sale_unit_price: number
    sale_total: number
  }>
}): Blob {
  const doc = new jsPDF()

  // Encabezado
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("Acme Estudio", 20, 25)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text("Sistema de Interiorismo y Mobiliario", 20, 33)

  // Número de cotización
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0)
  doc.text(quote.quote_number, 140, 25)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text(`Fecha: ${new Date(quote.quote_date).toLocaleDateString("es-CO")}`, 140, 33)
  doc.text(`Vigencia: ${quote.validity_days} días`, 140, 39)

  // Datos del cliente
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0)
  doc.text("Cliente:", 20, 55)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(quote.client_name, 20, 63)
  if (quote.client_email) doc.text(quote.client_email, 20, 70)
  if (quote.client_phone) doc.text(quote.client_phone, 20, 77)

  // Tabla de productos
  const tableData = quote.items.map((item) => [
    item.product_name,
    item.description || "",
    item.quantity.toString(),
    item.unit,
    formatCOP(item.sale_unit_price),
    formatCOP(item.sale_total),
  ])

  autoTable(doc, {
    startY: 90,
    head: [["Producto", "Descripción", "Cant.", "Unidad", "Precio Unit.", "Total"]],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
    },
  })

  // Totales
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(10)
  doc.text("Subtotal (sin IVA):", 120, finalY)
  doc.text(formatCOP(quote.subtotal_before_iva), 190, finalY, { align: "right" })

  doc.text(`IVA (${quote.iva_percentage}%):`, 120, finalY + 7)
  doc.text(formatCOP(quote.iva_amount), 190, finalY + 7, { align: "right" })

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL:", 120, finalY + 16)
  doc.text(formatCOP(quote.total_with_iva), 190, finalY + 16, { align: "right" })

  // Notas
  if (quote.notes) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text("Notas:", 20, finalY + 30)
    doc.text(quote.notes, 20, finalY + 37)
  }

  // Pie de página
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    "Esta cotización tiene una vigencia de 30 días a partir de la fecha de emisión.",
    20,
    280
  )

  return doc.output("blob")
}
