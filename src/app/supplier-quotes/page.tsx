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
import { Plus, FileText, Loader2 } from "lucide-react"
import { formatCOP } from "@/lib/pricing"

interface SupplierQuote {
  id: string
  quote_reference: string | null
  quote_date: string
  status: string
  source: string
  total_with_iva: number | null
  supplier: { id: string; name: string } | null
  created_at: string
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  partial: "Parcial",
  rejected: "Rechazada",
}

const statusVariants: Record<string, "warning" | "success" | "default" | "destructive"> = {
  pending: "warning",
  approved: "success",
  partial: "default",
  rejected: "destructive",
}

export default function SupplierQuotesPage() {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    const load = async () => {
      try {
        const url = statusFilter !== "all" ? `/api/quotes?status=${statusFilter}` : "/api/quotes"
        const res = await fetch(url)
        const data = await res.json()
        setQuotes(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [statusFilter])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cotizaciones de Proveedores</h1>
          <p className="text-muted-foreground mt-1">Gestiona y analiza cotizaciones recibidas</p>
        </div>
        <Button asChild>
          <Link href="/supplier-quotes/new">
            <Plus className="h-4 w-4" />
            Subir Cotización
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {loading ? "Cargando..." : `${quotes.length} cotizaciones`}
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobada</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="rejected">Rechazada</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay cotizaciones</h3>
              <p className="text-muted-foreground mb-4">
                Sube tu primera cotización de proveedor para empezar.
              </p>
              <Button asChild>
                <Link href="/supplier-quotes/new">
                  <Plus className="h-4 w-4" />
                  Subir Primera Cotización
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">Total c/IVA</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      {q.quote_reference || `COT-${q.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell>{q.supplier?.name || "Sin proveedor"}</TableCell>
                    <TableCell>
                      {new Date(q.quote_date).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[q.status] || "default"}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {q.source === "telegram" ? "Telegram" : "Web"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {q.total_with_iva ? formatCOP(q.total_with_iva) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/supplier-quotes/${q.id}`}>Ver</Link>
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
  )
}
