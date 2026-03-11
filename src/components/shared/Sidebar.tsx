"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Users, Package, ShoppingCart,
  Tag, Boxes, BarChart3, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier-quotes", label: "Cotizaciones Proveedores", icon: FileText },
  { href: "/suppliers", label: "Proveedores", icon: Users },
  { href: "/materials", label: "Materiales", icon: Boxes },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/client-quotes", label: "Cotizaciones Clientes", icon: ShoppingCart },
  { href: "/categories", label: "Categorías", icon: Tag },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-sidebar text-sidebar-foreground flex flex-col print:hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-sidebar-primary" />
          <div>
            <h1 className="font-bold text-base leading-tight">Acme Estudio</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestión de Cotizaciones</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Quick action */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link
          href="/supplier-quotes/new"
          className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Cotización
        </Link>
      </div>
    </aside>
  )
}
