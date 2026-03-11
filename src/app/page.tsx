import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Package, Users, TrendingUp } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/server"
import { formatPercent, formatCOP } from "@/lib/pricing"

async function getDashboardStats() {
  const supabase = createServiceClient()

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [quotesRes, productsRes, suppliersRes, marginsRes, recentQuotesRes] = await Promise.all([
    supabase
      .from("client_quotes")
      .select("id, total_with_iva", { count: "exact" })
      .gte("quote_date", firstOfMonth),
    supabase
      .from("sellable_products")
      .select("id", { count: "exact" })
      .eq("is_active", true),
    supabase
      .from("suppliers")
      .select("id", { count: "exact" }),
    supabase
      .from("sellable_products")
      .select("margin_percentage")
      .eq("is_active", true),
    supabase
      .from("client_quotes")
      .select("quote_number, client_name, total_with_iva, status, quote_date")
      .order("quote_date", { ascending: false })
      .limit(5),
  ])

  const quotesThisMonth = quotesRes.count ?? 0
  const totalThisMonth = (quotesRes.data ?? []).reduce((s, q) => s + (q.total_with_iva ?? 0), 0)
  const activeProducts = productsRes.count ?? 0
  const suppliersCount = suppliersRes.count ?? 0

  const margins = (marginsRes.data ?? []).map(p => p.margin_percentage).filter(Boolean)
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0

  return {
    quotesThisMonth,
    totalThisMonth,
    activeProducts,
    suppliersCount,
    avgMargin,
    recentQuotes: recentQuotesRes.data ?? [],
  }
}

const statusLabels: Record<string, string> = {
  draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada",
}
const statusColors: Record<string, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-600",
  accepted: "text-green-600",
  rejected: "text-red-500",
}

export default async function Dashboard() {
  const stats = await getDashboardStats()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen de Acme Estudio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cotizaciones este mes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quotesThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.quotesThisMonth === 0
                ? "Sin cotizaciones este mes"
                : `Total: ${formatCOP(stats.totalThisMonth)}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Productos activos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeProducts === 0 ? "Sin productos configurados" : "Con receta y precio"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Proveedores
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suppliersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.suppliersCount === 0 ? "Sin proveedores registrados" : "Registrados en el sistema"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Margen promedio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgMargin > 0 ? formatPercent(stats.avgMargin) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeProducts === 0 ? "Sin productos activos" : "Sobre productos activos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cotizaciones recientes */}
      {stats.recentQuotes.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Cotizaciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentQuotes.map((q) => (
                <div key={q.quote_number} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono font-semibold text-sm mr-3">{q.quote_number}</span>
                    <span className="text-sm">{q.client_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(q.quote_date).toLocaleDateString("es-CO")}
                    </span>
                    <span className="font-semibold">{formatCOP(q.total_with_iva)}</span>
                    <span className={statusColors[q.status] || "text-muted-foreground"}>
                      {statusLabels[q.status] || q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Bienvenido a Acme Estudio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sistema de gestión de cotizaciones de proveedores y productos de interiorismo.
            Empieza subiendo una cotización de proveedor o configurando tus productos.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-1">1. Sube cotizaciones</h3>
              <p className="text-muted-foreground">Analiza PDFs de proveedores con IA y compara precios automáticamente.</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-1">2. Configura productos</h3>
              <p className="text-muted-foreground">Define recetas con los materiales de cada producto y configura tu margen.</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-1">3. Genera cotizaciones</h3>
              <p className="text-muted-foreground">Crea cotizaciones profesionales para tus clientes con precios actualizados.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
