"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatCOP, getPriorityBadge } from "@/lib/pricing"
import { Boxes, Search } from "lucide-react"

interface MaterialItem {
  id: string
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
  priority: number | null
  quote_date: string | null
  supplier: { id: string; name: string } | null
  category: { id: string; name: string } | null
  quote: { quote_date: string; expiry_date: string | null } | null
}

interface Category {
  id: string
  name: string
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    const loadCategories = async () => {
      const res = await fetch("/api/categories")
      setCategories(await res.json())
    }
    loadCategories()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        if (categoryFilter !== "all") params.set("category_id", categoryFilter)
        const res = await fetch(`/api/materials?${params}`)
        const data = await res.json()
        setMaterials(Array.isArray(data) ? data : [])
        if (!res.ok) console.error("Materials API error:", data)
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [search, categoryFilter])

  // Agrupar por nombre de material
  const grouped = materials.reduce((acc, item) => {
    const key = item.product_name.toLowerCase().trim()
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, MaterialItem[]>)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Materiales</h1>
        <p className="text-muted-foreground mt-1">
          Vista consolidada de todos los materiales cotizados con comparación de precios
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar material..."
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

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando materiales...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">No hay materiales</h3>
          <p className="text-muted-foreground">Sube y aprueba cotizaciones de proveedores para ver los materiales.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, groupItems]) => {
            const bestItem = groupItems.find(i => i.priority === 1) || groupItems[0]
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{bestItem.product_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {bestItem.category && (
                        <Badge variant="outline">{bestItem.category.name}</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {groupItems.length} {groupItems.length === 1 ? "proveedor" : "proveedores"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Precio Unit. (sin IVA)</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead>Fecha Cot.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupItems.map((item) => {
                        const pBadge = getPriorityBadge(item.priority)
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <span className={`font-medium text-sm ${
                                pBadge.color === "green" ? "text-green-700" :
                                pBadge.color === "yellow" ? "text-yellow-700" :
                                "text-red-700"
                              }`}>
                                {pBadge.emoji} {pBadge.label}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.supplier?.name || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.description || "—"}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${item.priority === 1 ? "text-green-700" : ""}`}>
                              {formatCOP(item.unit_price_before_iva)}
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.quote?.quote_date
                                ? new Date(item.quote.quote_date).toLocaleDateString("es-CO")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
