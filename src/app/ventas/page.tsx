"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatCOP } from "@/lib/pricing"
import { DollarSign, Clock, TrendingUp, ShoppingBag, Eye } from "lucide-react"

interface Quote {
  id: string
  quote_number: string
  client_name: string
  quote_date: string
  accepted_at: string | null
  paid_at: string | null
  status: string
  total_with_iva: number | null
  items: { product_name: string; quantity: number; sale_total: number }[]
}

interface TopProduct {
  name: string
  category: string
  quantity: number
  total: number
}

interface Summary {
  totalAceptado: number
  totalPorCobrar: number
  totalCobrado: number
  countAceptado: number
  countPagado: number
}

interface Category {
  id: string
  name: string
}

export default function VentasPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (categoryFilter !== "all") params.set("category", categoryFilter)

    fetch(`/api/ventas?${params}`)
      .then(r => r.json())
      .then(data => {
        setQuotes(data.quotes ?? [])
        setSummary(data.summary ?? null)
        setTopProducts(data.topProducts ?? [])
      })
      .finally(() => setLoading(false))
  }, [statusFilter, categoryFilter])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ventas</h1>
        <p className="text-muted-foreground mt-1">Contabilidad de cotizaciones aceptadas y cobradas</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total facturado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCOP(summary?.totalAceptado ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(summary?.countAceptado ?? 0) + (summary?.countPagado ?? 0)} cotizaciones aceptadas
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Por cobrar</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCOP(summary?.totalPorCobrar ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.countAceptado ?? 0} pendientes de pago
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCOP(summary?.totalCobrado ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.countPagado ?? 0} pagos recibidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos vendidos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Referencias distintas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Filtros */}
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="accepted">Por cobrar</SelectItem>
                <SelectItem value="paid">Pagadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-52">
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

          {/* Tabla de cotizaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {loading ? "Cargando..." : `${quotes.length} cotizaciones`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 && !loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No hay cotizaciones aceptadas aún.</p>
                  <p className="text-sm mt-1">Acepta cotizaciones desde la sección de Cotizaciones Clientes.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono font-semibold">{q.quote_number}</TableCell>
                        <TableCell>{q.client_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(q.quote_date).toLocaleDateString("es-CO")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCOP(q.total_with_iva)}</TableCell>
                        <TableCell>
                          {q.status === "paid" ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Pagada</Badge>
                          ) : (
                            <Badge variant="secondary">Por cobrar</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/client-quotes/${q.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
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

        {/* Productos más vendidos */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Productos vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 8).map((p, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-start text-sm">
                        <div>
                          <p className="font-medium leading-tight">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                        <span className="font-semibold text-xs">{formatCOP(p.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.quantity} {p.quantity === 1 ? "unidad" : "unidades"}
                      </div>
                      {idx < topProducts.length - 1 && <hr />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
