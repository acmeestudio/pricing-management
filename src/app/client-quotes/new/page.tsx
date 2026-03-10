"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatCOP, formatPercent } from "@/lib/pricing"
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react"

interface Product {
  id: string
  name: string
  description: string | null
  sale_price_before_iva: number | null
  sale_price_with_iva: number | null
  production_cost: number | null
  profit_per_unit: number | null
  margin_percentage: number
  iva_percentage: number
}

interface QuoteItem {
  product_id: string
  product_name: string
  description: string
  quantity: number
  unit: string
  production_cost: number
  margin_percentage: number
  sale_unit_price: number
  sale_total: number
  profit: number
}

export default function NewClientQuotePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<QuoteItem[]>([])
  const [saving, setSaving] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addQuantity, setAddQuantity] = useState(1)
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    validity_days: 30,
    notes: "",
  })

  useEffect(() => {
    fetch("/api/products?active=true").then(r => r.json()).then(setProducts)
  }, [])

  const filteredProducts = productSearch
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : products

  const addItem = (product: Product) => {
    if (!product.sale_price_before_iva) {
      toast({ title: "Error", description: "Este producto no tiene precio configurado", variant: "destructive" })
      return
    }
    const saleTotal = product.sale_price_before_iva * addQuantity
    const prodCostTotal = (product.production_cost || 0)
    const profit = saleTotal - prodCostTotal * addQuantity

    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      description: product.description || "",
      quantity: addQuantity,
      unit: "unidad",
      production_cost: product.production_cost || 0,
      margin_percentage: product.margin_percentage,
      sale_unit_price: product.sale_price_before_iva!,
      sale_total: saleTotal,
      profit,
    }])
    setAddDialogOpen(false)
    setSelectedProduct(null)
    setProductSearch("")
    setAddQuantity(1)
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.sale_total, 0)
  const ivaAmount = subtotal * 0.19
  const total = subtotal + ivaAmount

  const handleSave = async () => {
    if (!form.client_name.trim()) {
      toast({ title: "Error", description: "El nombre del cliente es requerido", variant: "destructive" })
      return
    }
    if (items.length === 0) {
      toast({ title: "Error", description: "Agrega al menos un producto", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/client-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          iva_percentage: 19,
          items: items.map(i => ({
            sellable_product_id: i.product_id,
            product_name: i.product_name,
            description: i.description,
            quantity: i.quantity,
            unit: i.unit,
            production_cost: i.production_cost,
            margin_percentage: i.margin_percentage,
            sale_unit_price: i.sale_unit_price,
            sale_total: i.sale_total,
            profit: i.profit,
          })),
        }),
      })
      if (!res.ok) throw new Error()
      const quote = await res.json()
      toast({ title: "Cotización creada", description: `Número: ${quote.quote_number}` })
      router.push("/client-quotes")
    } catch {
      toast({ title: "Error", description: "No se pudo crear la cotización", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client-quotes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Cotización para Cliente</h1>
          <p className="text-muted-foreground">Selecciona productos del catálogo</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Datos del cliente */}
          <Card>
            <CardHeader><CardTitle>Datos del cliente</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nombre *</Label>
                <Input placeholder="Nombre completo del cliente" value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="cliente@email.com" value={form.client_email} onChange={(e) => setForm(f => ({ ...f, client_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input placeholder="300 123 4567" value={form.client_phone} onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vigencia (días)</Label>
                <Input type="number" value={form.validity_days} onChange={(e) => setForm(f => ({ ...f, validity_days: parseInt(e.target.value) || 30 }))} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input placeholder="Notas para la cotización" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* Productos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Productos ({items.length})</CardTitle>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Agregar Producto
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos. Agrega del catálogo.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium">{item.product_name}</p>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCOP(item.sale_unit_price)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCOP(item.sale_total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumen */}
        <div className="space-y-4">
          <Card className="border-2 border-primary/20">
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (sin IVA):</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA 19%:</span>
                <span>{formatCOP(ivaAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>TOTAL:</span>
                <span>{formatCOP(total)}</span>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full" onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? "Creando..." : "Crear Cotización"}
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/client-quotes">Cancelar</Link>
          </Button>
        </div>
      </div>

      {/* Dialog agregar producto */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar Producto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-auto space-y-2">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  className={`w-full text-left rounded-md border p-3 hover:bg-muted transition-colors ${selectedProduct?.id === p.id ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => setSelectedProduct(p)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </div>
                    <p className="font-semibold text-sm">{formatCOP(p.sale_price_with_iva)}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedProduct && (
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!selectedProduct}
              onClick={() => selectedProduct && addItem(selectedProduct)}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
