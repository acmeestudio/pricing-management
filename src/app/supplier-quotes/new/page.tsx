"use client"

import { useState, useEffect, useCallback } from "react"
import { pdfToImages } from "@/lib/pdf/pdf-to-images"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCOP, getPriorityBadge } from "@/lib/pricing"
import { Upload, Loader2, CheckCircle2, ArrowLeft, FileText, Trash2 } from "lucide-react"

interface ParsedItem {
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
  total_before_iva: number
  category_id?: string
  selected?: boolean
}

interface ParsedQuote {
  supplier_name: string | null
  quote_reference: string | null
  quote_date: string | null
  expiry_date: string | null
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  items: ParsedItem[]
}

interface Supplier {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

export default function NewSupplierQuotePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<"upload" | "review" | "saving">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsingStatus, setParsingStatus] = useState("")
  const [parsed, setParsed] = useState<ParsedQuote | null>(null)
  const [items, setItems] = useState<ParsedItem[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0])
  const [saving, setSaving] = useState(false)

  // Cargar proveedores y categorías al montar
  useEffect(() => {
    const load = async () => {
      const [suppRes, catRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/categories"),
      ])
      const [suppData, catData] = await Promise.all([suppRes.json(), catRes.json()])
      setSuppliers(suppData)
      setCategories(catData)
    }
    load()
  }, [])

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Error", description: "Solo se aceptan archivos PDF", variant: "destructive" })
      return
    }
    setFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    try {
      setParsingStatus("Convirtiendo PDF a imágenes...")
      const images = await pdfToImages(file)

      setParsingStatus(`Analizando ${images.length} página(s) con IA...`)
      const res = await fetch("/api/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      })
      if (!res.ok) throw new Error("Error al parsear")
      const data: ParsedQuote = await res.json()
      setParsed(data)
      setItems((data.items || []).map(item => ({ ...item, selected: true })))
      if (data.quote_date) setQuoteDate(data.quote_date)
      setStep("review")
    } catch {
      toast({ title: "Error", description: "No se pudo analizar el PDF", variant: "destructive" })
    } finally {
      setParsing(false)
      setParsingStatus("")
    }
  }

  const updateItem = (index: number, field: keyof ParsedItem, value: string | number | boolean) => {
    setItems(prev => {
      const next = [...prev]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(next[index] as any)[field] = value
      if (field === "quantity" || field === "unit_price_before_iva") {
        next[index].total_before_iva = next[index].quantity * next[index].unit_price_before_iva
      }
      return next
    })
  }

  const handleSave = async () => {
    const selectedItems = items.filter(i => i.selected)
    if (!selectedItems.length) {
      toast({ title: "Error", description: "Selecciona al menos un ítem", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      // 1. Crear la cotización padre
      const quoteRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: selectedSupplierId || null,
          quote_reference: parsed?.quote_reference || null,
          quote_date: quoteDate,
          expiry_date: parsed?.expiry_date || null,
          subtotal_before_iva: parsed?.subtotal_before_iva || null,
          iva_amount: parsed?.iva_amount || null,
          total_with_iva: parsed?.total_with_iva || null,
          status: "pending",
          source: "web",
        }),
      })
      if (!quoteRes.ok) throw new Error()
      const quote = await quoteRes.json()

      // 2. Crear ítems
      const itemsRes = await fetch("/api/quotes/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedItems.map(item => ({
          supplier_quote_id: quote.id,
          supplier_id: selectedSupplierId || null,
          category_id: item.category_id || null,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_before_iva: item.unit_price_before_iva,
          total_before_iva: item.total_before_iva,
          quote_date: quoteDate,
        }))),
      })
      if (!itemsRes.ok) throw new Error()

      // 3. Aprobar los ítems
      const savedItems = await itemsRes.json()
      await fetch("/api/quotes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_ids: savedItems.map((i: { id: string }) => i.id),
          quote_id: quote.id,
        }),
      })

      toast({ title: "Cotización guardada y aprobada" })
      router.push(`/supplier-quotes/${quote.id}`)
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (step === "upload") {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Subir Cotización de Proveedor</h1>
            <p className="text-muted-foreground">Analiza automáticamente con IA</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Proveedor */}
            <div className="mb-6 space-y-2">
              <Label>Proveedor (opcional)</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Si no seleccionas, se detectará del PDF</p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                ${file ? "border-green-500 bg-green-50" : ""}
              `}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <p className="font-semibold text-green-700">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  >
                    Cambiar archivo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="font-semibold">Arrastra el PDF aquí</p>
                  <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
                  <p className="text-xs text-muted-foreground mt-2">Solo archivos PDF</p>
                </div>
              )}
            </div>

            {file && (
              <Button
                className="w-full mt-4"
                onClick={handleParse}
                disabled={parsing}
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {parsingStatus || "Analizando con IA..."}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Analizar PDF
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step: review
  const selectedCount = items.filter(i => i.selected).length
  const total = items.reduce((sum, i) => i.selected ? sum + i.total_before_iva : sum, 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("upload")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Revisar Ítems Detectados</h1>
            <p className="text-muted-foreground">
              {parsed?.supplier_name && `Proveedor: ${parsed.supplier_name} · `}
              {items.length} ítems detectados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-right">
            <div className="text-muted-foreground">{selectedCount} seleccionados</div>
            <div className="font-semibold">{formatCOP(total)} sin IVA</div>
          </div>
          <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprobar y Guardar
          </Button>
        </div>
      </div>

      {/* Info de la cotización */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="space-y-1">
          <Label>Fecha de cotización</Label>
          <Input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder={parsed?.supplier_name || "Seleccionar..."} />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Referencia</Label>
          <Input
            value={parsed?.quote_reference || ""}
            readOnly
            placeholder="Auto-detectada del PDF"
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={items.every(i => i.selected)}
                    onChange={(e) => setItems(prev => prev.map(i => ({ ...i, selected: e.target.checked })))}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio Unit. (sin IVA)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx} className={!item.selected ? "opacity-40" : ""}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => updateItem(idx, "selected", e.target.checked)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.product_name}
                      onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                      className="min-w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description || ""}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      placeholder="Especificaciones..."
                      className="min-w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.category_id || ""}
                      onValueChange={(val) => updateItem(idx, "category_id", val)}
                    >
                      <SelectTrigger className="min-w-32">
                        <SelectValue placeholder="Categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-20 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.unit}
                      onChange={(e) => updateItem(idx, "unit", e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.unit_price_before_iva}
                      onChange={(e) => updateItem(idx, "unit_price_before_iva", parseFloat(e.target.value) || 0)}
                      className="w-32 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCOP(item.total_before_iva)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
