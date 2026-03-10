"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCOP, formatPercent, getPriorityBadge } from "@/lib/pricing"
import { ArrowLeft, Edit, Package } from "lucide-react"

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
  is_active: boolean
  category: { name: string } | null
  recipes: Array<{
    id: string
    material_name: string
    quantity_needed: number
    unit: string
    unit_cost: number | null
    line_cost: number | null
    category: { name: string } | null
    quote_item: {
      product_name: string
      unit_price_before_iva: number
      priority: number | null
      supplier: { name: string } | null
    } | null
  }>
}

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then(r => r.json())
      .then(setProduct)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!product) return <div className="p-8">Producto no encontrado</div>

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            {!product.is_active && <Badge variant="secondary">Inactivo</Badge>}
          </div>
          {product.category && <p className="text-muted-foreground">{product.category.name}</p>}
        </div>
        <Button asChild>
          <Link href={`/products/${product.id}/recipe`}>
            <Edit className="h-4 w-4" />
            Editar Receta
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Precios</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Costo materiales:</span><span>{formatCOP(product.production_cost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costos adicionales:</span><span>{formatCOP(product.additional_costs)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Costo total:</span><span>{formatCOP(product.total_cost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margen:</span><span className="text-blue-700 font-medium">{formatPercent(product.margin_percentage)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Precio venta (sin IVA):</span><span>{formatCOP(product.sale_price_before_iva)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IVA {formatPercent(product.iva_percentage)}:</span><span>{formatCOP(product.iva_amount)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Precio final:</span><span>{formatCOP(product.sale_price_with_iva)}</span></div>
              <div className="flex justify-between text-green-700 font-semibold"><span>Ganancia:</span><span>{formatCOP(product.profit_per_unit)}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Receta ({product.recipes?.length || 0} materiales)</CardTitle></CardHeader>
          <CardContent>
            {(!product.recipes || product.recipes.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Sin materiales.</p>
                <Button className="mt-3" size="sm" asChild>
                  <Link href={`/products/${product.id}/recipe`}>Configurar receta</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {product.recipes.map((r) => {
                  const pBadge = r.quote_item ? getPriorityBadge(r.quote_item.priority) : null
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{r.material_name}</p>
                        <p className="text-xs text-muted-foreground">{r.quantity_needed} {r.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCOP(r.line_cost)}</p>
                        {r.quote_item && pBadge && (
                          <p className="text-xs text-muted-foreground">
                            {pBadge.emoji} {r.quote_item.supplier?.name}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
