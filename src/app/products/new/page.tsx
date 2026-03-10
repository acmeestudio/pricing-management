"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { calculatePricing, formatCOP, formatPercent } from "@/lib/pricing"
import { ArrowLeft, Package } from "lucide-react"

interface Category {
  id: string
  name: string
}

export default function NewProductPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    category_id: "",
    margin_percentage: 45,
    iva_percentage: 19,
    additional_costs: 0,
  })

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories)
  }, [])

  const pricing = calculatePricing({
    productionCost: 0,
    additionalCosts: form.additional_costs,
    marginPercentage: form.margin_percentage,
    ivaPercentage: form.iva_percentage,
  })

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category_id: form.category_id || null,
        }),
      })
      if (!res.ok) throw new Error()
      const product = await res.json()
      toast({ title: "Producto creado", description: "Ahora configura la receta de materiales." })
      router.push(`/products/${product.id}/recipe`)
    } catch {
      toast({ title: "Error", description: "No se pudo crear el producto", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Producto</h1>
          <p className="text-muted-foreground">Configura el producto y después agrega la receta</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Información del producto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del producto *</Label>
              <Input
                placeholder="Ej: Mesa de comedor Roble 6 puestos"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Configuración de precios</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Margen (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={form.margin_percentage}
                  onChange={(e) => setForm(f => ({ ...f, margin_percentage: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>IVA (%)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.iva_percentage}
                  onChange={(e) => setForm(f => ({ ...f, iva_percentage: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Costos adicionales (COP)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.additional_costs}
                  onChange={(e) => setForm(f => ({ ...f, additional_costs: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Preview de precios */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2 text-sm">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">
                Resumen de precios (sin materiales aún)
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costos adicionales:</span>
                <span>{formatCOP(form.additional_costs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margen:</span>
                <span>{formatPercent(form.margin_percentage)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Precio venta (sin IVA):</span>
                <span className="font-semibold">{formatCOP(pricing.salePriceBeforeIva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA {formatPercent(form.iva_percentage)}:</span>
                <span>{formatCOP(pricing.ivaAmount)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">Precio final:</span>
                <span className="font-bold">{formatCOP(pricing.salePriceWithIva)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link href="/products">Cancelar</Link></Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Creando..." : "Crear y configurar receta →"}
          </Button>
        </div>
      </div>
    </div>
  )
}
