"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCOP } from "@/lib/pricing"
import { Plus, ShoppingCart, Trash2 } from "lucide-react"

interface ClientQuote {
  id: string
  quote_number: string
  client_name: string
  client_email: string | null
  quote_date: string
  validity_days: number
  total_with_iva: number | null
  status: string
}

const statusLabels: Record<string, string> = {
  draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada",
}
const statusVariants: Record<string, "outline" | "default" | "success" | "destructive"> = {
  draft: "outline", sent: "default", accepted: "success", rejected: "destructive",
}

export default function ClientQuotesPage() {
  const [quotes, setQuotes] = useState<ClientQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/client-quotes").then(r => r.json()).then(setQuotes).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, quoteNumber: string) {
    if (!confirm(`¿Eliminar la cotización ${quoteNumber}? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/client-quotes/${id}`, { method: "DELETE" })
      if (res.ok) setQuotes(prev => prev.filter(q => q.id !== id))
      else alert("Error al eliminar la cotización.")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cotizaciones para Clientes</h1>
          <p className="text-muted-foreground mt-1">Genera y gestiona cotizaciones profesionales</p>
        </div>
        <Button asChild>
          <Link href="/client-quotes/new">
            <Plus className="h-4 w-4" />
            Nueva Cotización
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {loading ? "Cargando..." : `${quotes.length} cotizaciones`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay cotizaciones</h3>
              <p className="text-muted-foreground mb-4">Crea la primera cotización para un cliente.</p>
              <Button asChild><Link href="/client-quotes/new"><Plus className="h-4 w-4" />Nueva Cotización</Link></Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-semibold">{q.quote_number}</TableCell>
                    <TableCell className="font-medium">{q.client_name}</TableCell>
                    <TableCell>{new Date(q.quote_date).toLocaleDateString("es-CO")}</TableCell>
                    <TableCell>{q.validity_days} días</TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(q.total_with_iva)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[q.status] || "outline"}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/client-quotes/${q.id}`}>Ver</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deleting === q.id}
                        onClick={() => handleDelete(q.id, q.quote_number)}
                      >
                        <Trash2 className="h-4 w-4" />
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
