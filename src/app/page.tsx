import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Package, Users, TrendingUp } from "lucide-react"

export default function Dashboard() {
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Cargando...</p>
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Cargando...</p>
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Cargando...</p>
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Cargando...</p>
          </CardContent>
        </Card>
      </div>

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
