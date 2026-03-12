"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCOP } from "@/lib/pricing"
import {
  Upload, Loader2, CheckCircle2, ArrowLeft, FileText, Trash2, Plus, PenLine,
  Files, Clock, AlertCircle, ChevronDown, ChevronUp, XCircle,
} from "lucide-react"

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
  supplier_nit: string | null
  supplier_email: string | null
  supplier_phone: string | null
  supplier_city: string | null
  supplier_contact: string | null
  quote_reference: string | null
  quote_date: string | null
  expiry_date: string | null
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  iva_included: "yes" | "no" | "unknown"
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

interface SupplierForm {
  name: string; nit: string; email: string; phone: string; city: string; contact: string
}

interface BatchItem {
  id: string
  file: File
  status: "pending" | "analyzing" | "ready" | "saving" | "saved" | "error"
  parsed?: ParsedQuote
  error?: string
  items: ParsedItem[]
  supplierForm: SupplierForm
  selectedSupplierId: string
  quoteDate: string
  expiryDate: string
  quoteReference: string
  showIvaColumns: boolean
  ivaRate: number
  expanded: boolean
}

const emptyItem = (): ParsedItem => ({
  product_name: "",
  description: null,
  quantity: 1,
  unit: "unidad",
  unit_price_before_iva: 0,
  total_before_iva: 0,
  selected: true,
})

const defaultSupplierForm = (): SupplierForm => ({ name: "", nit: "", email: "", phone: "", city: "", contact: "" })

export default function NewSupplierQuotePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [mode, setMode] = useState<"pdf" | "manual" | "batch">("pdf")

  // PDF flow
  const [step, setStep] = useState<"upload" | "review">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsingStatus, setParsingStatus] = useState("")
  const [parsed, setParsed] = useState<ParsedQuote | null>(null)

  // Batch flow
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchDragging, setBatchDragging] = useState(false)

  // Shared state
  const [items, setItems] = useState<ParsedItem[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("")
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0])
  const [expiryDate, setExpiryDate] = useState("")
  const [quoteReference, setQuoteReference] = useState("")
  const [saving, setSaving] = useState(false)
  const [ivaRate, setIvaRate] = useState(19)
  const [showIvaColumns, setShowIvaColumns] = useState(false)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(defaultSupplierForm())

  useEffect(() => {
    const load = async () => {
      const [suppRes, catRes] = await Promise.all([fetch("/api/suppliers"), fetch("/api/categories")])
      const [suppData, catData] = await Promise.all([suppRes.json(), catRes.json()])
      setSuppliers(suppData)
      setCategories(catData)
    }
    load()
  }, [])

  const switchMode = (m: "pdf" | "manual" | "batch") => {
    setMode(m)
    setStep("upload")
    setFile(null)
    setParsed(null)
    setItems(m === "manual" ? [emptyItem()] : [])
    setSelectedSupplierId("")
    setSupplierForm(defaultSupplierForm())
    setQuoteDate(new Date().toISOString().split("T")[0])
    setExpiryDate("")
    setQuoteReference("")
    setDefaultCategoryId("")
  }

  const applyDefaultCategory = (catId: string) => {
    setDefaultCategoryId(catId)
    if (catId) {
      setItems(prev => prev.map(i => ({ ...i, category_id: catId })))
    }
  }

  // --- PDF handlers ---
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    try {
      setParsingStatus("Preparando PDF...")
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setParsingStatus("Analizando con IA...")
      const res = await fetch("/api/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
      })
      if (!res.ok) throw new Error("Error al parsear")
      const data: ParsedQuote = await res.json()
      setParsed(data)
      setItems((data.items || []).map(item => ({ ...item, selected: true })))
      if (data.quote_date) setQuoteDate(data.quote_date)
      if (data.expiry_date) setExpiryDate(data.expiry_date)
      if (data.quote_reference) setQuoteReference(data.quote_reference)
      setShowIvaColumns(data.iva_included !== "yes")
      setSupplierForm({
        name: data.supplier_name || "",
        nit: data.supplier_nit || "",
        email: data.supplier_email || "",
        phone: data.supplier_phone || "",
        city: data.supplier_city || "",
        contact: data.supplier_contact || "",
      })
      setStep("review")
    } catch {
      toast({ title: "Error", description: "No se pudo analizar el PDF", variant: "destructive" })
    } finally {
      setParsing(false)
      setParsingStatus("")
    }
  }

  // --- Items handlers ---
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

  const addRow = () => setItems(prev => [...prev, { ...emptyItem(), category_id: defaultCategoryId || undefined }])

  // --- Save (shared for pdf/manual) ---
  const handleSave = async () => {
    const selectedItems = items.filter(i => i.selected)
    if (!selectedItems.length) {
      toast({ title: "Error", description: "Agrega al menos un ítem", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      let supplierId = selectedSupplierId || null
      if (!supplierId && supplierForm.name.trim()) {
        const suppRes = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: supplierForm.name.trim(),
            contact_name: supplierForm.contact || null,
            phone: supplierForm.phone || null,
            email: supplierForm.email || null,
            city: supplierForm.city || null,
            notes: supplierForm.nit ? `NIT: ${supplierForm.nit}` : null,
          }),
        })
        if (suppRes.ok) {
          const newSupplier = await suppRes.json()
          supplierId = newSupplier.id
          setSelectedSupplierId(newSupplier.id)
          setSuppliers(prev => [...prev, newSupplier])
        }
      }

      const subtotal = selectedItems.reduce((s, i) => s + i.total_before_iva, 0)
      const ivaAmt = showIvaColumns ? subtotal * (ivaRate / 100) : null

      const quoteRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          quote_reference: quoteReference || parsed?.quote_reference || null,
          quote_date: quoteDate,
          expiry_date: expiryDate || parsed?.expiry_date || null,
          subtotal_before_iva: parsed?.subtotal_before_iva || subtotal || null,
          iva_amount: parsed?.iva_amount || ivaAmt || null,
          total_with_iva: parsed?.total_with_iva || (showIvaColumns ? subtotal + (ivaAmt || 0) : null) || null,
          status: "pending",
          source: mode === "manual" ? "manual" : "web",
        }),
      })
      if (!quoteRes.ok) throw new Error()
      const quote = await quoteRes.json()

      const itemsRes = await fetch("/api/quotes/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedItems.map(item => ({
          supplier_quote_id: quote.id,
          supplier_id: supplierId,
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

  // --- Batch handlers ---
  const analyzeSingleBatchItem = async (batchId: string, f: File) => {
    setBatchItems(prev => prev.map(b => b.id === batchId ? { ...b, status: "analyzing" } : b))
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(f)
      })
      const res = await fetch("/api/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
      })
      if (!res.ok) throw new Error()
      const data: ParsedQuote = await res.json()
      setBatchItems(prev => prev.map(b => b.id === batchId ? {
        ...b,
        status: "ready",
        parsed: data,
        items: (data.items || []).map(item => ({ ...item, selected: true })),
        supplierForm: {
          name: data.supplier_name || "",
          nit: data.supplier_nit || "",
          email: data.supplier_email || "",
          phone: data.supplier_phone || "",
          city: data.supplier_city || "",
          contact: data.supplier_contact || "",
        },
        quoteDate: data.quote_date || new Date().toISOString().split("T")[0],
        expiryDate: data.expiry_date || "",
        quoteReference: data.quote_reference || "",
        showIvaColumns: data.iva_included !== "yes",
      } : b))
    } catch {
      setBatchItems(prev => prev.map(b => b.id === batchId ? { ...b, status: "error", error: "No se pudo analizar el PDF" } : b))
    }
  }

  const runWithConcurrency = async (newItems: BatchItem[]) => {
    const CONCURRENCY = 3
    let idx = 0
    const next = async (): Promise<void> => {
      const i = idx++
      if (i >= newItems.length) return
      await analyzeSingleBatchItem(newItems[i].id, newItems[i].file)
      await next()
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, newItems.length) }, () => next()))
  }

  const handleBatchFiles = (files: FileList | File[]) => {
    const all = Array.from(files)
    const pdfs = all.filter(f => f.type === "application/pdf")
    if (pdfs.length === 0) {
      toast({ title: "Error", description: "Solo se aceptan archivos PDF", variant: "destructive" })
      return
    }
    if (pdfs.length < all.length) {
      toast({ description: `Se ignoraron ${all.length - pdfs.length} archivos que no son PDF` })
    }
    const newBatch: BatchItem[] = pdfs.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
      items: [],
      supplierForm: defaultSupplierForm(),
      selectedSupplierId: "",
      quoteDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      quoteReference: "",
      showIvaColumns: false,
      ivaRate: 19,
      expanded: false,
    }))
    setBatchItems(prev => [...prev, ...newBatch])
    runWithConcurrency(newBatch)
  }

  const updateBatchItem = (batchId: string, updates: Partial<BatchItem>) => {
    setBatchItems(prev => prev.map(b => b.id === batchId ? { ...b, ...updates } : b))
  }

  const updateBatchItemRow = (batchId: string, idx: number, field: keyof ParsedItem, value: string | number | boolean) => {
    setBatchItems(prev => prev.map(b => {
      if (b.id !== batchId) return b
      const newItems = [...b.items]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newItems[idx] as any)[field] = value
      if (field === "quantity" || field === "unit_price_before_iva") {
        newItems[idx].total_before_iva = newItems[idx].quantity * newItems[idx].unit_price_before_iva
      }
      return { ...b, items: newItems }
    }))
  }

  const saveBatchItem = async (batchId: string) => {
    const bItem = batchItems.find(b => b.id === batchId)
    if (!bItem) return
    const selectedItems = bItem.items.filter(i => i.selected)
    if (!selectedItems.length) {
      toast({ title: "Error", description: "Selecciona al menos un ítem", variant: "destructive" })
      return
    }
    updateBatchItem(batchId, { status: "saving" })
    try {
      let supplierId = bItem.selectedSupplierId || null
      if (!supplierId && bItem.supplierForm.name.trim()) {
        const suppRes = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bItem.supplierForm.name.trim(),
            contact_name: bItem.supplierForm.contact || null,
            phone: bItem.supplierForm.phone || null,
            email: bItem.supplierForm.email || null,
            city: bItem.supplierForm.city || null,
            notes: bItem.supplierForm.nit ? `NIT: ${bItem.supplierForm.nit}` : null,
          }),
        })
        if (suppRes.ok) {
          const newSupplier = await suppRes.json()
          supplierId = newSupplier.id
          setSuppliers(prev => [...prev, newSupplier])
        }
      }

      const subtotal = selectedItems.reduce((s, i) => s + i.total_before_iva, 0)
      const ivaAmt = bItem.showIvaColumns ? subtotal * (bItem.ivaRate / 100) : null
      const p = bItem.parsed

      const quoteRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          quote_reference: bItem.quoteReference || p?.quote_reference || null,
          quote_date: bItem.quoteDate,
          expiry_date: bItem.expiryDate || p?.expiry_date || null,
          subtotal_before_iva: p?.subtotal_before_iva || subtotal || null,
          iva_amount: p?.iva_amount || ivaAmt || null,
          total_with_iva: p?.total_with_iva || (bItem.showIvaColumns ? subtotal + (ivaAmt || 0) : null) || null,
          status: "pending",
          source: "web",
        }),
      })
      if (!quoteRes.ok) throw new Error()
      const quote = await quoteRes.json()

      const itemsRes = await fetch("/api/quotes/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedItems.map(item => ({
          supplier_quote_id: quote.id,
          supplier_id: supplierId,
          category_id: item.category_id || null,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_before_iva: item.unit_price_before_iva,
          total_before_iva: item.total_before_iva,
          quote_date: bItem.quoteDate,
        }))),
      })
      if (!itemsRes.ok) throw new Error()
      const savedItems = await itemsRes.json()

      await fetch("/api/quotes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: savedItems.map((i: { id: string }) => i.id), quote_id: quote.id }),
      })

      updateBatchItem(batchId, { status: "saved" })
      toast({ title: "Cotización guardada", description: bItem.supplierForm.name || bItem.file.name })
    } catch {
      updateBatchItem(batchId, { status: "error", error: "No se pudo guardar" })
      toast({ title: "Error", description: "No se pudo guardar la cotización", variant: "destructive" })
    }
  }

  const selectedCount = items.filter(i => i.selected).length
  const total = items.reduce((sum, i) => i.selected ? sum + i.total_before_iva : sum, 0)
  const ivaMultiplier = 1 + ivaRate / 100

  // ─── Mode tabs component ──────────────────────────────────────────
  const ModeTabs = ({ current }: { current: string }) => (
    <div className="flex rounded-lg border p-1 mb-6 bg-muted/30 gap-1">
      {[
        { key: "pdf", icon: <FileText className="h-4 w-4" />, label: "Subir PDF" },
        { key: "batch", icon: <Files className="h-4 w-4" />, label: "Subir en Lote" },
        { key: "manual", icon: <PenLine className="h-4 w-4" />, label: "Manual" },
      ].map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => switchMode(key as "pdf" | "manual" | "batch")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            current === key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {icon}{label}
        </button>
      ))}
    </div>
  )

  // ─── BATCH MODE ───────────────────────────────────────────────────
  if (mode === "batch") {
    const readyCount = batchItems.filter(b => b.status === "ready").length
    const savedCount = batchItems.filter(b => b.status === "saved").length
    const analyzingCount = batchItems.filter(b => b.status === "analyzing" || b.status === "pending").length

    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nueva Cotización de Proveedor</h1>
            <p className="text-muted-foreground">Sube un PDF o ingrésala manualmente</p>
          </div>
        </div>

        <ModeTabs current="batch" />

        {/* Drop zone */}
        <div
          onDrop={(e) => { e.preventDefault(); setBatchDragging(false); handleBatchFiles(e.dataTransfer.files) }}
          onDragOver={(e) => { e.preventDefault(); setBatchDragging(true) }}
          onDragLeave={() => setBatchDragging(false)}
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer mb-6 ${
            batchDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => document.getElementById("batch-file-input")?.click()}
        >
          <input
            id="batch-file-input"
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleBatchFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <Files className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Arrastra múltiples PDFs aquí</p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar varios archivos</p>
            {batchItems.length > 0 && (
              <p className="text-xs text-primary mt-1">
                {batchItems.length} PDF{batchItems.length !== 1 ? "s" : ""} cargado{batchItems.length !== 1 ? "s" : ""}
                {analyzingCount > 0 && ` · ${analyzingCount} analizando`}
                {readyCount > 0 && ` · ${readyCount} listo${readyCount !== 1 ? "s" : ""}`}
                {savedCount > 0 && ` · ${savedCount} guardado${savedCount !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>

        {batchItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Files className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Sube tus PDFs para comenzar el análisis en paralelo</p>
            <p className="text-sm mt-1">Puedes subir 10, 20, 50 PDFs al mismo tiempo</p>
          </div>
        )}

        <div className="space-y-3">
          {batchItems.map((bItem) => {
            const bTotal = bItem.items.reduce((s, i) => i.selected ? s + i.total_before_iva : s, 0)
            const bSelectedCount = bItem.items.filter(i => i.selected).length
            const bIvaMultiplier = 1 + bItem.ivaRate / 100

            return (
              <Card key={bItem.id} className={`overflow-hidden ${
                bItem.status === "saved" ? "border-green-200 bg-green-50/30" :
                bItem.status === "error" ? "border-red-200 bg-red-50/30" : ""
              }`}>
                {/* Card header row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-shrink-0">
                    {(bItem.status === "pending") && <Clock className="h-5 w-5 text-muted-foreground/50" />}
                    {bItem.status === "analyzing" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {bItem.status === "ready" && <Clock className="h-5 w-5 text-amber-500" />}
                    {bItem.status === "saving" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {bItem.status === "saved" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {bItem.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{bItem.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bItem.status === "pending" && "En cola..."}
                      {bItem.status === "analyzing" && "Analizando con IA..."}
                      {bItem.status === "ready" && (
                        bItem.supplierForm.name
                          ? `${bItem.supplierForm.name} · ${bItem.items.length} ítems · ${formatCOP(bTotal)} sin IVA`
                          : `${bItem.items.length} ítems detectados · ${formatCOP(bTotal)} sin IVA`
                      )}
                      {bItem.status === "saving" && "Guardando..."}
                      {bItem.status === "saved" && `Guardado · ${bItem.supplierForm.name || ""}`}
                      {bItem.status === "error" && (bItem.error || "Error al procesar")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {bItem.status === "error" && (
                      <Button size="sm" variant="outline" onClick={() => {
                        updateBatchItem(bItem.id, { status: "pending", error: undefined })
                        analyzeSingleBatchItem(bItem.id, bItem.file)
                      }}>
                        Reintentar
                      </Button>
                    )}
                    {bItem.status === "ready" && (
                      <>
                        <Button size="sm" onClick={() => saveBatchItem(bItem.id)} disabled={bSelectedCount === 0}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateBatchItem(bItem.id, { expanded: !bItem.expanded })}>
                          {bItem.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {bItem.expanded ? "Ocultar" : "Revisar"}
                        </Button>
                      </>
                    )}
                    {(bItem.status === "saved" || bItem.status === "error") && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setBatchItems(prev => prev.filter(b => b.id !== bItem.id))}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded review */}
                {bItem.expanded && bItem.status === "ready" && (
                  <div className="border-t px-4 pb-4 pt-4 space-y-4">
                    {/* Supplier */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Datos del Proveedor</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Razón social", k: "name", ph: "Nombre del proveedor" },
                          { label: "NIT", k: "nit", ph: "900123456-7" },
                          { label: "Contacto", k: "contact", ph: "Nombre del contacto" },
                          { label: "Email", k: "email", ph: "correo@proveedor.com" },
                          { label: "Teléfono", k: "phone", ph: "300 123 4567" },
                          { label: "Ciudad", k: "city", ph: "Bogotá" },
                        ].map(({ label, k, ph }) => (
                          <div key={k} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              value={bItem.supplierForm[k as keyof SupplierForm]}
                              onChange={e => updateBatchItem(bItem.id, { supplierForm: { ...bItem.supplierForm, [k]: e.target.value } })}
                              placeholder={ph}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quote meta */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Fecha cotización</Label>
                        <Input type="date" value={bItem.quoteDate} onChange={e => updateBatchItem(bItem.id, { quoteDate: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vencimiento</Label>
                        <Input type="date" value={bItem.expiryDate} onChange={e => updateBatchItem(bItem.id, { expiryDate: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Referencia</Label>
                        <Input value={bItem.quoteReference} onChange={e => updateBatchItem(bItem.id, { quoteReference: e.target.value })} placeholder="COT-2024-001" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IVA</Label>
                        <div className="flex items-center gap-2 h-8">
                          <input
                            type="checkbox"
                            checked={bItem.showIvaColumns}
                            onChange={e => updateBatchItem(bItem.id, { showIvaColumns: e.target.checked })}
                            className="rounded w-4 h-4"
                          />
                          <span className="text-xs text-muted-foreground">Mostrar</span>
                          {bItem.showIvaColumns && (
                            <>
                              <Input type="number" value={bItem.ivaRate} onChange={e => updateBatchItem(bItem.id, { ivaRate: parseFloat(e.target.value) || 0 })} className="w-14 h-8 text-right text-sm" />
                              <span className="text-xs">%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <input
                                type="checkbox"
                                checked={bItem.items.length > 0 && bItem.items.every(i => i.selected)}
                                onChange={e => updateBatchItem(bItem.id, { items: bItem.items.map(i => ({ ...i, selected: e.target.checked })) })}
                                className="rounded"
                              />
                            </TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                            <TableHead>Un.</TableHead>
                            <TableHead className="text-right">Precio (sin IVA)</TableHead>
                            {bItem.showIvaColumns && <TableHead className="text-right">Con IVA</TableHead>}
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bItem.items.map((item, idx) => (
                            <TableRow key={idx} className={!item.selected ? "opacity-40" : ""}>
                              <TableCell>
                                <input type="checkbox" checked={item.selected} onChange={e => updateBatchItemRow(bItem.id, idx, "selected", e.target.checked)} className="rounded" />
                              </TableCell>
                              <TableCell>
                                <Input value={item.product_name} onChange={e => updateBatchItemRow(bItem.id, idx, "product_name", e.target.value)} className="min-w-32 h-7 text-sm" />
                              </TableCell>
                              <TableCell>
                                <Select value={item.category_id || ""} onValueChange={val => updateBatchItemRow(bItem.id, idx, "category_id", val)}>
                                  <SelectTrigger className="min-w-28 h-7 text-sm"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                                  <SelectContent>
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={item.quantity} onChange={e => updateBatchItemRow(bItem.id, idx, "quantity", parseFloat(e.target.value) || 0)} className="w-16 text-right h-7 text-sm" />
                              </TableCell>
                              <TableCell>
                                <Input value={item.unit} onChange={e => updateBatchItemRow(bItem.id, idx, "unit", e.target.value)} className="w-16 h-7 text-sm" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={item.unit_price_before_iva} onChange={e => updateBatchItemRow(bItem.id, idx, "unit_price_before_iva", parseFloat(e.target.value) || 0)} className="w-28 text-right h-7 text-sm" />
                              </TableCell>
                              {bItem.showIvaColumns && (
                                <TableCell className="text-right text-muted-foreground text-sm">{formatCOP(item.unit_price_before_iva * bIvaMultiplier)}</TableCell>
                              )}
                              <TableCell className="text-right font-medium text-sm">{formatCOP(item.total_before_iva)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => updateBatchItem(bItem.id, { items: bItem.items.filter((_, i) => i !== idx) })}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="pt-2 flex justify-between items-center">
                        <Button size="sm" variant="outline" onClick={() => updateBatchItem(bItem.id, { items: [...bItem.items, emptyItem()] })}>
                          <Plus className="h-3.5 w-3.5" />
                          Agregar ítem
                        </Button>
                        <div className="text-sm text-right">
                          <span className="text-muted-foreground">Subtotal: </span>
                          <span className="font-semibold">{formatCOP(bTotal)}</span>
                          {bItem.showIvaColumns && (
                            <span className="ml-3 text-muted-foreground">Con IVA: <span className="font-semibold text-foreground">{formatCOP(bTotal * bIvaMultiplier)}</span></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <Button onClick={() => saveBatchItem(bItem.id)} disabled={bSelectedCount === 0}>
                        <CheckCircle2 className="h-4 w-4" />
                        Guardar cotización
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── STEP: UPLOAD (PDF mode) ──────────────────────────────────────
  if (mode === "pdf" && step === "upload") {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nueva Cotización de Proveedor</h1>
            <p className="text-muted-foreground">Sube un PDF o ingrésala manualmente</p>
          </div>
        </div>

        <ModeTabs current="pdf" />

        <Card>
          <CardContent className="pt-6">
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

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
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
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
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
              <Button className="w-full mt-4" onClick={handleParse} disabled={parsing}>
                {parsing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{parsingStatus || "Analizando con IA..."}</>
                ) : (
                  <><FileText className="h-4 w-4" />Analizar PDF</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── MANUAL MODE ──────────────────────────────────────────────────
  if (mode === "manual") {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Nueva Cotización Manual</h1>
            <p className="text-muted-foreground">Ingresa los datos del proveedor y los ítems</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => switchMode("pdf")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Subir PDF
            </button>
            <button
              onClick={() => switchMode("batch")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <Files className="h-4 w-4" />
              Subir en Lote
            </button>
            <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar cotización
            </Button>
          </div>
        </div>

        {/* Datos del proveedor */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Datos del Proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label className="text-xs mb-1 block">Proveedor existente</Label>
              <Select value={selectedSupplierId} onValueChange={(v) => {
                setSelectedSupplierId(v)
                setSupplierForm(defaultSupplierForm())
              }}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Buscar proveedor guardado..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplierId && (
                <button onClick={() => setSelectedSupplierId("")} className="text-xs text-muted-foreground underline mt-1">
                  o crear nuevo proveedor
                </button>
              )}
            </div>

            {!selectedSupplierId && (
              <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Razón social *</Label>
                  <Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del proveedor" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NIT</Label>
                  <Input value={supplierForm.nit} onChange={e => setSupplierForm(f => ({ ...f, nit: e.target.value }))} placeholder="900123456-7" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contacto</Label>
                  <Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="Nombre del contacto" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@proveedor.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Teléfono</Label>
                  <Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="300 123 4567" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ciudad</Label>
                  <Input value={supplierForm.city} onChange={e => setSupplierForm(f => ({ ...f, city: e.target.value }))} placeholder="Bogotá" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Datos de la cotización */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="space-y-1">
            <Label className="text-sm">Fecha cotización *</Label>
            <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Fecha vencimiento</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Referencia</Label>
            <Input value={quoteReference} onChange={(e) => setQuoteReference(e.target.value)} placeholder="Ej: COT-2024-001" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Categoría (todos los ítems)</Label>
            <Select value={defaultCategoryId} onValueChange={applyDefaultCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Asignar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Precios sin IVA</Label>
            <div className="flex items-center gap-3 h-10">
              <input
                type="checkbox"
                id="toggle-iva-manual"
                checked={showIvaColumns}
                onChange={(e) => setShowIvaColumns(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <label htmlFor="toggle-iva-manual" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar IVA
              </label>
              {showIvaColumns && (
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} max={100} value={ivaRate} onChange={(e) => setIvaRate(parseFloat(e.target.value) || 0)} className="w-16 text-right" />
                  <span className="text-sm">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de ítems */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Ítems de la cotización
              {selectedCount > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">
                  — {formatCOP(total)} sin IVA
                  {showIvaColumns && ` · ${formatCOP(total * ivaMultiplier)} con IVA`}
                </span>
              )}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Agregar ítem
            </Button>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every(i => i.selected)}
                      onChange={(e) => setItems(prev => prev.map(i => ({ ...i, selected: e.target.checked })))}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Producto *</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio Unit. (sin IVA)</TableHead>
                  {showIvaColumns && <TableHead className="text-right">Con IVA</TableHead>}
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx} className={!item.selected ? "opacity-40" : ""}>
                    <TableCell>
                      <input type="checkbox" checked={item.selected} onChange={(e) => updateItem(idx, "selected", e.target.checked)} className="rounded" />
                    </TableCell>
                    <TableCell>
                      <Input value={item.product_name} onChange={(e) => updateItem(idx, "product_name", e.target.value)} placeholder="Nombre del producto" className="min-w-40" />
                    </TableCell>
                    <TableCell>
                      <Input value={item.description || ""} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Especificaciones..." className="min-w-36" />
                    </TableCell>
                    <TableCell>
                      <Select value={item.category_id || ""} onValueChange={(val) => updateItem(idx, "category_id", val)}>
                        <SelectTrigger className="min-w-32"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="w-20 text-right" />
                    </TableCell>
                    <TableCell>
                      <Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="w-24" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={item.unit_price_before_iva} onChange={(e) => updateItem(idx, "unit_price_before_iva", parseFloat(e.target.value) || 0)} className="w-36 text-right" />
                    </TableCell>
                    {showIvaColumns && (
                      <TableCell className="text-right text-muted-foreground text-sm">{formatCOP(item.unit_price_before_iva * ivaMultiplier)}</TableCell>
                    )}
                    <TableCell className="text-right font-medium">{formatCOP(item.total_before_iva)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">No hay ítems aún</p>
                      <Button size="sm" variant="outline" onClick={addRow}>
                        <Plus className="h-4 w-4" />
                        Agregar primer ítem
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {items.length > 0 && (
              <div className="pt-3 flex justify-between items-center">
                <Button size="sm" variant="outline" onClick={addRow}>
                  <Plus className="h-4 w-4" />
                  Agregar ítem
                </Button>
                <div className="text-sm text-right space-y-0.5">
                  <div className="text-muted-foreground">Subtotal sin IVA: <span className="font-semibold text-foreground">{formatCOP(total)}</span></div>
                  {showIvaColumns && (
                    <div className="text-muted-foreground">Total con IVA ({ivaRate}%): <span className="font-semibold text-foreground">{formatCOP(total * ivaMultiplier)}</span></div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── STEP: REVIEW (PDF mode after parsing) ────────────────────────
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
            {showIvaColumns && (
              <div className="text-muted-foreground">{formatCOP(total * ivaMultiplier)} con IVA ({ivaRate}%)</div>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprobar y Guardar
          </Button>
        </div>
      </div>

      {/* Datos del proveedor detectados */}
      {!selectedSupplierId && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3 pt-4 px-6">
            <CardTitle className="text-sm font-medium text-blue-800">
              Datos del Proveedor detectados — revisa y corrige si es necesario
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Razón social *</Label>
                <Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del proveedor" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NIT</Label>
                <Input value={supplierForm.nit} onChange={e => setSupplierForm(f => ({ ...f, nit: e.target.value }))} placeholder="900123456-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contacto</Label>
                <Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="Nombre del contacto" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@proveedor.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="300 123 4567" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Input value={supplierForm.city} onChange={e => setSupplierForm(f => ({ ...f, city: e.target.value }))} placeholder="Bogotá" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="space-y-1">
          <Label>Fecha de cotización</Label>
          <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
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
            value={quoteReference || parsed?.quote_reference || ""}
            onChange={(e) => setQuoteReference(e.target.value)}
            placeholder="Auto-detectada del PDF"
          />
        </div>
        <div className="space-y-1">
          <Label>Categoría (todos los ítems)</Label>
          <Select value={defaultCategoryId} onValueChange={applyDefaultCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Asignar categoría..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Mostrar IVA</Label>
          <div className="flex items-center gap-3 h-10">
            <input
              type="checkbox"
              id="toggle-iva"
              checked={showIvaColumns}
              onChange={(e) => setShowIvaColumns(e.target.checked)}
              className="rounded w-4 h-4"
            />
            <label htmlFor="toggle-iva" className="text-sm text-muted-foreground cursor-pointer">
              Precios sin IVA
            </label>
            {showIvaColumns && (
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} value={ivaRate} onChange={(e) => setIvaRate(parseFloat(e.target.value) || 0)} className="w-20 text-right" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
          </div>
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
                {showIvaColumns && <TableHead className="text-right">Precio Unit. (con IVA)</TableHead>}
                <TableHead className="text-right">Total (sin IVA)</TableHead>
                {showIvaColumns && <TableHead className="text-right">Total (con IVA)</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx} className={!item.selected ? "opacity-40" : ""}>
                  <TableCell>
                    <input type="checkbox" checked={item.selected} onChange={(e) => updateItem(idx, "selected", e.target.checked)} className="rounded" />
                  </TableCell>
                  <TableCell>
                    <Input value={item.product_name} onChange={(e) => updateItem(idx, "product_name", e.target.value)} className="min-w-36" />
                  </TableCell>
                  <TableCell>
                    <Input value={item.description || ""} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Especificaciones..." className="min-w-36" />
                  </TableCell>
                  <TableCell>
                    <Select value={item.category_id || ""} onValueChange={(val) => updateItem(idx, "category_id", val)}>
                      <SelectTrigger className="min-w-32"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="w-20 text-right" />
                  </TableCell>
                  <TableCell>
                    <Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="w-20" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.unit_price_before_iva} onChange={(e) => updateItem(idx, "unit_price_before_iva", parseFloat(e.target.value) || 0)} className="w-32 text-right" />
                  </TableCell>
                  {showIvaColumns && (
                    <TableCell className="text-right text-muted-foreground">{formatCOP(item.unit_price_before_iva * ivaMultiplier)}</TableCell>
                  )}
                  <TableCell className="text-right font-medium">{formatCOP(item.total_before_iva)}</TableCell>
                  {showIvaColumns && (
                    <TableCell className="text-right font-semibold text-blue-700">{formatCOP(item.total_before_iva * ivaMultiplier)}</TableCell>
                  )}
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
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
