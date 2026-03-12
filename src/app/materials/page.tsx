"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCOP, getPriorityBadge } from "@/lib/pricing"
import { Boxes, Search, Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react"

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

interface CategoryFolder {
  id: string
  name: string
  products: Record<string, MaterialItem[]>
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        const res = await fetch(`/api/materials?${params}`)
        const data = await res.json()
        const items = Array.isArray(data) ? data : []
        setMaterials(items)

        // Auto-open all folders on first load or when searching
        const catIds = new Set<string>()
        items.forEach((item: MaterialItem) => {
          catIds.add(item.category?.id || "__none__")
        })
        setOpenFolders(catIds)
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Agrupar por categoría, luego por nombre de producto
  const byCategory: Record<string, CategoryFolder> = {}
  materials.forEach(item => {
    const catId = item.category?.id || "__none__"
    const catName = item.category?.name || "Sin categoría"
    if (!byCategory[catId]) {
      byCategory[catId] = { id: catId, name: catName, products: {} }
    }
    const prodKey = item.product_name.toLowerCase().trim()
    if (!byCategory[catId].products[prodKey]) {
      byCategory[catId].products[prodKey] = []
    }
    byCategory[catId].products[prodKey].push(item)
  })

  // Ordenar: categorías con nombre primero, "Sin categoría" al final
  const sortedFolders = Object.values(byCategory).sort((a, b) => {
    if (a.id === "__none__") return 1
    if (b.id === "__none__") return -1
    return a.name.localeCompare(b.name)
  })

  const toggleFolder = (id: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalProducts = Object.values(byCategory).reduce(
    (sum, folder) => sum + Object.keys(folder.products).length, 0
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Materiales</h1>
        <p className="text-muted-foreground mt-1">
          Vista consolidada de todos los materiales cotizados, organizados por categoría
        </p>
      </div>

      {/* Buscador */}
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
        {!loading && totalProducts > 0 && (
          <div className="flex items-center text-sm text-muted-foreground">
            {sortedFolders.length} {sortedFolders.length === 1 ? "categoría" : "categorías"} · {totalProducts} {totalProducts === 1 ? "producto" : "productos"}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando materiales...</div>
      ) : sortedFolders.length === 0 ? (
        <div className="text-center py-12">
          <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">No hay materiales</h3>
          <p className="text-muted-foreground">Sube y aprueba cotizaciones de proveedores para ver los materiales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFolders.map(folder => {
            const isOpen = openFolders.has(folder.id)
            const productEntries = Object.entries(folder.products)

            return (
              <div key={folder.id} className="border rounded-lg overflow-hidden">
                {/* Folder header */}
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  }
                  {isOpen
                    ? <FolderOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    : <Folder className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  }
                  <span className="font-semibold text-sm flex-1">{folder.name}</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {productEntries.length} {productEntries.length === 1 ? "producto" : "productos"}
                  </Badge>
                </button>

                {/* Folder contents */}
                {isOpen && (
                  <div className="divide-y">
                    {productEntries.map(([key, groupItems]) => {
                      const bestItem = groupItems.find(i => i.priority === 1) || groupItems[0]
                      return (
                        <Card key={key} className="rounded-none border-0 border-b last:border-b-0 shadow-none">
                          <CardHeader className="pb-3 px-6 pt-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{bestItem.product_name}</CardTitle>
                              <span className="text-sm text-muted-foreground">
                                {groupItems.length} {groupItems.length === 1 ? "proveedor" : "proveedores"}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="px-6 pb-4">
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
          })}
        </div>
      )}
    </div>
  )
}
