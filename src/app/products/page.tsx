"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { formatCOP, formatPercent } from "@/lib/pricing"
import { Plus, Package, Search, TrendingUp } from "lucide-react"

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
  category: { id: string; name: string } | null
}

interface Category {
  id: string
  name: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (categoryFilter !== "all") params.set("category_id", categoryFilter)
        const res = await fetch(`/api/products?${params}`)
        const data = await res.json()
        const filtered = search
          ? data.filter((p: Product) => p.name.toLowerCase().includes(search.toLowerCase()))
          : data
        setProducts(filtered)
      } finally {
        setLoading(false)
      }
    }
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search, categoryFilter])

  const activeProducts = products.filter(p => p.is_active)
  const avgMargin = activeProducts.length
    ? activeProducts.reduce((s, p) => s + p.margin_percentage, 0) / activeProducts.length
    : 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground mt-1">Catálogo de productos vendibles con precios y márgenes</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Productos activos</p>
            <p className="text-2xl font-bold mt-1">{activeProducts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Margen promedio</p>
            <p className="text-2xl font-bold mt-1">{formatPercent(avgMargin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Categorías</p>
            <p className="text-2xl font-bold mt-1">
              {new Set(activeProducts.map(p => p.category?.id).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-0 overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando productos...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay productos</h3>
              <p className="text-muted-foreground mb-4">Crea tu primer producto con receta y márgenes configurados.</p>
              <Button asChild>
                <Link href="/products/new">
                  <Plus className="h-4 w-4" />
                  Crear Primer Producto
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Costo Prod.</TableHead>
                  <TableHead className="text-right">Costo Total</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Precio Venta</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Precio Final</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className={!p.is_active ? "opacity-40" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {!p.is_active && <Badge variant="outline" className="text-xs mt-1">Inactivo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{p.category?.name || "—"}</TableCell>
                    <TableCell className="text-right">{formatCOP(p.production_cost)}</TableCell>
                    <TableCell className="text-right">{formatCOP(p.total_cost)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-blue-700">{formatPercent(p.margin_percentage)}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCOP(p.sale_price_before_iva)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCOP(p.iva_amount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(p.sale_price_with_iva)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-green-700">{formatCOP(p.profit_per_unit)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products/${p.id}`}>Ver</Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products/${p.id}/recipe`}>
                            <TrendingUp className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
