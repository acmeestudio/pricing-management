"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCOP, getPriorityBadge } from "@/lib/pricing"
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react"

interface QuoteItem {
  id: string
  product_name: string
  description: string | null
  quantity: number
  unit: string
  unit_price_before_iva: number
  total_before_iva: number
  priority: number | null
  is_approved: boolean
  category: { name: string } | null
}

interface Quote {
  id: string
  quote_reference: string | null
  quote_date: string
  expiry_date: string | null
  status: string
  source: string
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  supplier: { id: string; name: string; contact_name: string | null; phone: string | null } | null
  items: QuoteItem[]
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  partial: "Parcial",
  rejected: "Rechazada",
}

export default function SupplierQuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes/${params.id}`)
        const data = await res.json()
        setQuote(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!quote) return <div className="p-8">Cotización no encontrada</div>

  const approvedItems = quote.items?.filter(i => i.is_approved) || []
  const pendingItems = quote.items?.filter(i => !i.is_approved) || []

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/supplier-quotes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {quote.quote_reference || `Cotización ${quote.id.slice(0, 8)}`}
            </h1>
            <Badge variant={quote.status === "approved" ? "success" : quote.status === "pending" ? "warning" : "default"}>
              {statusLabels[quote.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {quote.supplier?.name || "Sin proveedor"} · {new Date(quote.quote_date).toLocaleDateString("es-CO")}
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="font-semibold mt-1">{quote.supplier?.name || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total sin IVA</p>
            <p className="font-semibold mt-1">{formatCOP(quote.subtotal_before_iva)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">IVA</p>
            <p className="font-semibold mt-1">{formatCOP(quote.iva_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total con IVA</p>
            <p className="font-semibold mt-1 text-lg">{formatCOP(quote.total_with_iva)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {quote.items?.length || 0} ítems
            {approvedItems.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({approvedItems.length} aprobados, {pendingItems.length} pendientes)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(quote.items || []).map((item) => {
                const pBadge = getPriorityBadge(item.priority)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.description || "—"}</TableCell>
                    <TableCell>{item.category?.name || "—"}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{formatCOP(item.unit_price_before_iva)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(item.total_before_iva)}</TableCell>
                    <TableCell>
                      {item.is_approved ? (
                        <span className="text-sm">{pBadge.emoji} P{item.priority || "?"}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.is_approved ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aprobado
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
