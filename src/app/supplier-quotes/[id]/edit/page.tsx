"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
import { ArrowLeft, Save, Loader2, Trash2, Plus } from "lucide-react"

interface QuoteItem {
  id: string
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
  total_before_iva: number
  category_id: string | null
  category: { id: string; name: string } | null
  is_approved: boolean
}

interface Quote {
  id: string
  quote_reference: string | null
  quote_date: string
  expiry_date: string | null
  status: string
  supplier: { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null } | null
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  items: QuoteItem[]
}

interface Category {
  id: string
  name: string
}

const statusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "approved", label: "Aprobada" },
  { value: "partial", label: "Parcial" },
  { value: "rejected", label: "Rechazada" },
]

export default function EditQuotePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Header fields
  const [quoteReference, setQuoteReference] = useState("")
  const [quoteDate, setQuoteDate] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [status, setStatus] = useState("pending")
  const [supplierName, setSupplierName] = useState("")
  const [supplierContact, setSupplierContact] = useState("")
  const [supplierPhone, setSupplierPhone] = useState("")
  const [supplierEmail, setSupplierEmail] = useState("")

  // Items (local editable copy)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [deletingItem, setDeletingItem] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [quoteRes, catRes] = await Promise.all([
          fetch(`/api/quotes/${params.id}`),
          fetch("/api/categories"),
        ])
        const quoteData: Quote = await quoteRes.json()
        const catData: Category[] = await catRes.json()

        setQuote(quoteData)
        setCategories(catData)

        setQuoteReference(quoteData.quote_reference || "")
        setQuoteDate(quoteData.quote_date ? quoteData.quote_date.slice(0, 10) : "")
        setExpiryDate(quoteData.expiry_date ? quoteData.expiry_date.slice(0, 10) : "")
        setStatus(quoteData.status || "pending")
        setSupplierName(quoteData.supplier?.name || "")
        setSupplierContact(quoteData.supplier?.contact_name || "")
        setSupplierPhone(quoteData.supplier?.phone || "")
        setSupplierEmail(quoteData.supplier?.email || "")
        setItems(quoteData.items || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  function updateItem(id: string, field: string, value: string | number | null) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      // Recalculate total when quantity or price changes
      if (field === "quantity" || field === "unit_price_before_iva") {
        updated.total_before_iva = updated.quantity * updated.unit_price_before_iva
      }
      return updated
    }))
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("¿Eliminar este ítem?")) return
    setDeletingItem(itemId)
    try {
      const res = await fetch(`/api/quotes/items/${itemId}`, { method: "DELETE" })
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== itemId))
        toast({ title: "Ítem eliminado" })
      } else {
        toast({ title: "Error al eliminar el ítem", variant: "destructive" })
      }
    } finally {
      setDeletingItem(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // 1. Update supplier if it exists
      if (quote?.supplier?.id) {
        await fetch(`/api/suppliers/${quote.supplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: supplierName,
            contact_name: supplierContact || null,
            phone: supplierPhone || null,
            email: supplierEmail || null,
          }),
        })
      }

      // 2. Update quote header
      const quoteRes = await fetch(`/api/quotes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_reference: quoteReference || null,
          quote_date: quoteDate,
          expiry_date: expiryDate || null,
          status,
        }),
      })

      if (!quoteRes.ok) {
        toast({ title: "Error al guardar la cotización", variant: "destructive" })
        return
      }

      // 3. Update each item
      const itemUpdates = items.map(item =>
        fetch(`/api/quotes/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_name: item.product_name,
            description: item.description || null,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_before_iva: item.unit_price_before_iva,
            total_before_iva: item.total_before_iva,
            category_id: item.category_id || null,
          }),
        })
      )
      await Promise.all(itemUpdates)

      toast({ title: "Cotización actualizada correctamente" })
      router.push(`/supplier-quotes/${params.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!quote) return <div className="p-8">Cotización no encontrada</div>

  const subtotal = items.reduce((sum, i) => sum + (i.total_before_iva || 0), 0)
  const iva = subtotal * 0.19
  const total = subtotal + iva

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/supplier-quotes/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Editar Cotización</h1>
          <p className="text-muted-foreground text-sm">
            {quote.quote_reference || `Cotización ${quote.id.slice(0, 8)}`}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>

      <div className="space-y-6">
        {/* Quote info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información general</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input
                value={quoteReference}
                onChange={e => setQuoteReference(e.target.value)}
                placeholder="Ej: 2500109"
              />
            </div>
            <div className="space-y-1">
              <Label>Fecha de cotización</Label>
              <Input
                type="date"
                value={quoteDate}
                onChange={e => setQuoteDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Supplier info */}
        {quote.supplier && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proveedor</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Contacto</Label>
                <Input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{items.length} ítems</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  <TableHead className="min-w-[160px]">Descripción</TableHead>
                  <TableHead className="min-w-[160px]">Categoría</TableHead>
                  <TableHead className="w-24 text-right">Cantidad</TableHead>
                  <TableHead className="w-24">Unidad</TableHead>
                  <TableHead className="w-36 text-right">Precio Unit.</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.product_name}
                        onChange={e => updateItem(item.id, "product_name", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.description || ""}
                        onChange={e => updateItem(item.id, "description", e.target.value || null)}
                        className="h-8 text-sm"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.category_id || "none"}
                        onValueChange={v => updateItem(item.id, "category_id", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Sin categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin categoría</SelectItem>
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
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm text-right"
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.unit}
                        onChange={e => updateItem(item.id, "unit", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price_before_iva}
                        onChange={e => updateItem(item.id, "unit_price_before_iva", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm text-right"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCOP(item.total_before_iva)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingItem === item.id}
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        {deletingItem === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3" />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="space-y-1 text-sm min-w-[220px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal sin IVA:</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA (19%):</span>
                  <span>{formatCOP(iva)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total con IVA:</span>
                  <span>{formatCOP(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save button bottom */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href={`/supplier-quotes/${params.id}`}>Cancelar</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
