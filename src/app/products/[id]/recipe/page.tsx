"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { calculatePricing, formatCOP, formatPercent, getPriorityBadge } from "@/lib/pricing"
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react"
import { MaterialPickerDialog } from "@/components/MaterialPickerDialog"

interface RecipeItem {
  id: string
  material_name: string
  quantity_needed: number
  unit: string
  unit_cost: number | null
  line_cost: number | null
  category: { name: string } | null
  quote_item: {
    id: string
    product_name: string
    unit_price_before_iva: number
    unit: string
    priority: number | null
    supplier: { name: string } | null
  } | null
}

interface Product {
  id: string
  name: string
  description: string | null
  margin_percentage: number
  iva_percentage: number
  additional_costs: number | null
  production_cost: number | null
  total_cost: number | null
  sale_price_before_iva: number | null
  iva_amount: number | null
  sale_price_with_iva: number | null
  profit_per_unit: number | null
}


export default function RecipePage() {
  const params = useParams()
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [recipe, setRecipe] = useState<RecipeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [productMargin, setProductMargin] = useState(45)
  const [productAdditional, setProductAdditional] = useState(0)
  const [productIva, setProductIva] = useState(19)

  const loadData = useCallback(async () => {
    try {
      const [productRes, recipeRes] = await Promise.all([
        fetch(`/api/products/${params.id}`),
        fetch(`/api/recipes?product_id=${params.id}`),
      ])
      const [productData, recipeData] = await Promise.all([
        productRes.json(),
        recipeRes.json(),
      ])
      setProduct(productData)
      setProductMargin(productData.margin_percentage)
      setProductAdditional(productData.additional_costs || 0)
      setProductIva(productData.iva_percentage)
      setRecipe(recipeData)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { loadData() }, [loadData])

  interface SelectedMaterial {
    material: {
      id: string
      product_name: string
      unit_price_before_iva: number
      unit: string
      priority: number | null
      supplier: { id: string; name: string } | null
      category: { id: string; name: string } | null
    }
    quantity: number
  }

  const handleAddItems = async (items: SelectedMaterial[]) => {
    await Promise.all(
      items.map((item) =>
        fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellable_product_id: params.id,
            supplier_quote_item_id: item.material.id.startsWith("manual-") ? null : item.material.id,
            material_name: item.material.product_name,
            material_category_id: item.material.category?.id || null,
            quantity_needed: item.quantity,
            unit: item.material.unit,
            unit_cost: item.material.unit_price_before_iva || null,
            notes: null,
          }),
        })
      )
    )
    toast({ title: `${items.length} material${items.length > 1 ? "es" : ""} agregado${items.length > 1 ? "s" : ""} a la receta` })
    loadData()
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este material de la receta?")) return
    try {
      await fetch(`/api/recipes/${id}`, { method: "DELETE" })
      toast({ title: "Material eliminado" })
      loadData()
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await fetch(`/api/products/${params.id}/recalculate`, { method: "POST" })
      await loadData()
      toast({ title: "Precios recalculados" })
    } catch {
      toast({ title: "Error al recalcular", variant: "destructive" })
    } finally {
      setRecalculating(false)
    }
  }

  const handleUpdateMargin = async () => {
    try {
      await fetch(`/api/products/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          margin_percentage: productMargin,
          additional_costs: productAdditional,
          iva_percentage: productIva,
        }),
      })
      await fetch(`/api/products/${params.id}/recalculate`, { method: "POST" })
      await loadData()
      toast({ title: "Configuración actualizada" })
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" })
    }
  }

  const productionCost = recipe.reduce((sum, r) => sum + (r.line_cost || 0), 0)
  const pricing = calculatePricing({
    productionCost,
    additionalCosts: productAdditional,
    marginPercentage: productMargin,
    ivaPercentage: productIva,
  })

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!product) return <div className="p-8">Producto no encontrado</div>

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">Receta de materiales y cálculo de precios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Agregar Material
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Receta */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Materiales de la receta ({recipe.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {recipe.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay materiales en la receta.</p>
                  <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Agregar Primer Material
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Costo Unit.</TableHead>
                      <TableHead className="text-right">Costo Línea</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipe.map((item) => {
                      const pBadge = item.quote_item ? getPriorityBadge(item.quote_item.priority) : null
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.material_name}</TableCell>
                          <TableCell>{item.category?.name || "—"}</TableCell>
                          <TableCell className="text-right">{item.quantity_needed}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">{formatCOP(item.unit_cost)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCOP(item.line_cost)}</TableCell>
                          <TableCell>
                            {item.quote_item && pBadge ? (
                              <div className="text-sm">
                                <span className={`${pBadge.color === "green" ? "text-green-700" : pBadge.color === "yellow" ? "text-yellow-700" : "text-red-700"}`}>
                                  {pBadge.emoji}
                                </span>
                                <span className="ml-1 text-muted-foreground">
                                  {item.quote_item.supplier?.name || "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-7 w-7"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={5} className="font-semibold text-right">Total materiales:</TableCell>
                      <TableCell className="text-right font-bold">{formatCOP(productionCost)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel de precios */}
        <div className="space-y-4">
          {/* Configuración */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Configuración</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Margen (%)</Label>
                <Input
                  type="number"
                  value={productMargin}
                  onChange={(e) => setProductMargin(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA (%)</Label>
                <Input
                  type="number"
                  value={productIva}
                  onChange={(e) => setProductIva(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costos adicionales (COP)</Label>
                <Input
                  type="number"
                  value={productAdditional}
                  onChange={(e) => setProductAdditional(parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <Button className="w-full h-8 text-xs" onClick={handleUpdateMargin}>
                Actualizar configuración
              </Button>
            </CardContent>
          </Card>

          {/* Resumen de precios */}
          <Card className="border-2 border-primary/20">
            <CardHeader><CardTitle className="text-sm">Resumen de precios</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo materiales:</span>
                <span>{formatCOP(productionCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costos adicionales:</span>
                <span>{formatCOP(productAdditional)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>COSTO TOTAL:</span>
                <span>{formatCOP(pricing.totalCost)}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-muted-foreground">Margen {formatPercent(productMargin)}:</span>
                <span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio venta (sin IVA):</span>
                <span>{formatCOP(pricing.salePriceBeforeIva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA {formatPercent(productIva)}:</span>
                <span>{formatCOP(pricing.ivaAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>PRECIO FINAL:</span>
                <span>{formatCOP(pricing.salePriceWithIva)}</span>
              </div>
              <div className="flex justify-between text-green-700 font-semibold mt-1">
                <span>Ganancia por unidad:</span>
                <span>{formatCOP(pricing.profitPerUnit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MaterialPickerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddItems={handleAddItems}
      />
    </div>
  )
}
