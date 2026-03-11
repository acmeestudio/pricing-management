"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatCOP } from "@/lib/pricing"
import { ArrowLeft, Building2, Printer, CheckCircle, XCircle, DollarSign } from "lucide-react"

interface QuoteItem {
  id: string
  product_name: string
  description: string | null
  quantity: number
  unit: string
  sale_unit_price: number
  sale_total: number
}

interface ClientQuote {
  id: string
  quote_number: string
  client_name: string
  client_email: string | null
  client_phone: string | null
  quote_date: string
  validity_days: number
  iva_percentage: number
  subtotal_before_iva: number | null
  iva_amount: number | null
  total_with_iva: number | null
  status: string
  notes: string | null
  accepted_at: string | null
  paid_at: string | null
  items: QuoteItem[]
}

interface CompanyInfo {
  name: string
  email: string
  phone: string
  city: string
  address: string
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: "Acme Estudio",
  email: "",
  phone: "",
  city: "",
  address: "",
}

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  paid: "Pagada",
}
const statusVariants: Record<string, "outline" | "default" | "success" | "destructive" | "secondary"> = {
  draft: "outline",
  sent: "default",
  accepted: "secondary",
  rejected: "destructive",
  paid: "success",
}

function loadCompany(): CompanyInfo {
  if (typeof window === "undefined") return DEFAULT_COMPANY
  try {
    const saved = localStorage.getItem("acme_company_info")
    return saved ? { ...DEFAULT_COMPANY, ...JSON.parse(saved) } : DEFAULT_COMPANY
  } catch {
    return DEFAULT_COMPANY
  }
}

function saveCompany(info: CompanyInfo) {
  localStorage.setItem("acme_company_info", JSON.stringify(info))
}

export default function ClientQuoteDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast()
  const [quote, setQuote] = useState<ClientQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY)
  const [editingCompany, setEditingCompany] = useState(false)
  const [companyDraft, setCompanyDraft] = useState<CompanyInfo>(DEFAULT_COMPANY)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setCompany(loadCompany())
  }, [])

  useEffect(() => {
    fetch(`/api/client-quotes/${params.id}`)
      .then(r => {
        if (!r.ok) throw new Error("No encontrada")
        return r.json()
      })
      .then(data => setQuote(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id])

  async function updateStatus(newStatus: string) {
    if (!quote) return
    setUpdating(true)
    try {
      const body: Record<string, string> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === "accepted") body.accepted_at = new Date().toISOString()
      if (newStatus === "paid") body.paid_at = new Date().toISOString()

      const res = await fetch(`/api/client-quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setQuote(q => q ? { ...q, ...updated } : q)
      toast({ title: "Estado actualizado", description: `Cotización marcada como ${statusLabels[newStatus]}` })
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const openEditCompany = () => {
    setCompanyDraft({ ...company })
    setEditingCompany(true)
  }

  const saveCompanyInfo = () => {
    saveCompany(companyDraft)
    setCompany(companyDraft)
    setEditingCompany(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Cargando cotización...</p>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/client-quotes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Cotización no encontrada</h1>
        </div>
        <p className="text-muted-foreground">{error || "La cotización no existe."}</p>
      </div>
    )
  }

  const subtotal = quote.subtotal_before_iva ?? quote.items.reduce((s, i) => s + i.sale_total, 0)
  const ivaAmount = quote.iva_amount ?? subtotal * (quote.iva_percentage / 100)
  const total = quote.total_with_iva ?? subtotal + ivaAmount

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/client-quotes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cotización {quote.quote_number}</h1>
            <p className="text-muted-foreground text-sm">
              {new Date(quote.quote_date).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEditCompany}>
            <Building2 className="h-4 w-4" />
            Empresa
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Acciones de estado */}
      <div className="flex items-center gap-2 mb-6 print:hidden flex-wrap">
        {(quote.status === "draft" || quote.status === "sent") && (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updating}
              onClick={() => updateStatus("accepted")}
            >
              <CheckCircle className="h-4 w-4" />
              Marcar como Aceptada
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={updating}
              onClick={() => updateStatus("rejected")}
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          </>
        )}
        {quote.status === "accepted" && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={updating}
            onClick={() => updateStatus("paid")}
          >
            <DollarSign className="h-4 w-4" />
            Marcar como Pagada
          </Button>
        )}
        {quote.status === "paid" && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
            <DollarSign className="h-4 w-4" />
            Pago recibido
            {quote.paid_at && (
              <span className="text-muted-foreground">
                — {new Date(quote.paid_at).toLocaleDateString("es-CO")}
              </span>
            )}
          </div>
        )}
        {quote.status === "rejected" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updating}
            onClick={() => updateStatus("draft")}
          >
            Volver a Borrador
          </Button>
        )}
      </div>

      {/* Documento */}
      <Card className="shadow-md print:shadow-none">
        <CardContent className="p-8 space-y-8">

          {/* Encabezado */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{company.name}</h2>
              {company.city && <p className="text-sm text-muted-foreground">{company.city}</p>}
              {company.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
              {company.email && <p className="text-sm text-muted-foreground">{company.email}</p>}
              {company.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
              {!company.email && !company.phone && !company.city && (
                <button
                  onClick={openEditCompany}
                  className="text-sm text-primary underline underline-offset-2 mt-1 print:hidden"
                >
                  + Agregar datos de la empresa
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Cotización</p>
              <p className="text-3xl font-bold font-mono">{quote.quote_number}</p>
              <Badge variant={statusVariants[quote.status] || "outline"} className="mt-2">
                {statusLabels[quote.status] || quote.status}
              </Badge>
            </div>
          </div>

          <hr />

          {/* Cliente y vigencia */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Cliente</p>
              <p className="font-semibold text-lg">{quote.client_name}</p>
              {quote.client_email && <p className="text-sm text-muted-foreground">{quote.client_email}</p>}
              {quote.client_phone && <p className="text-sm text-muted-foreground">{quote.client_phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Detalles</p>
              <p className="text-sm">
                <span className="text-muted-foreground">Fecha: </span>
                {new Date(quote.quote_date).toLocaleDateString("es-CO")}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Vigencia: </span>
                {quote.validity_days} días
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Vence: </span>
                {new Date(new Date(quote.quote_date).getTime() + quote.validity_days * 86400000).toLocaleDateString("es-CO")}
              </p>
              {quote.accepted_at && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Aceptada: </span>
                  {new Date(quote.accepted_at).toLocaleDateString("es-CO")}
                </p>
              )}
              {quote.paid_at && (
                <p className="text-sm text-green-700 font-medium">
                  <span className="text-muted-foreground font-normal">Pagada: </span>
                  {new Date(quote.paid_at).toLocaleDateString("es-CO")}
                </p>
              )}
            </div>
          </div>

          {/* Tabla de productos */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Productos / Servicios</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-20">Cant.</TableHead>
                  <TableHead className="text-right w-36">Precio unitario</TableHead>
                  <TableHead className="text-right w-36">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product_name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right">{formatCOP(item.sale_unit_price)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(item.sale_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totales */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (sin IVA):</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA {quote.iva_percentage}%:</span>
                <span>{formatCOP(ivaAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>TOTAL:</span>
                <span>{formatCOP(total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="bg-muted/40 rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Notas</p>
              <p className="text-sm">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog empresa */}
      <Dialog open={editingCompany} onOpenChange={setEditingCompany}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Datos de la empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre de la empresa *</Label>
              <Input value={companyDraft.name} onChange={e => setCompanyDraft(d => ({ ...d, name: e.target.value }))} placeholder="Acme Estudio" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={companyDraft.email} onChange={e => setCompanyDraft(d => ({ ...d, email: e.target.value }))} placeholder="contacto@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={companyDraft.phone} onChange={e => setCompanyDraft(d => ({ ...d, phone: e.target.value }))} placeholder="300 123 4567" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={companyDraft.city} onChange={e => setCompanyDraft(d => ({ ...d, city: e.target.value }))} placeholder="Bogotá, Colombia" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={companyDraft.address} onChange={e => setCompanyDraft(d => ({ ...d, address: e.target.value }))} placeholder="Calle 123 # 45-67" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(false)}>Cancelar</Button>
            <Button onClick={saveCompanyInfo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
