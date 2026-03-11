"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatCOP, getPriorityBadge } from "@/lib/pricing"
import { Search, Plus, Minus, ShoppingCart, X, Package, ChevronRight } from "lucide-react"

interface MaterialOption {
  id: string
  product_name: string
  unit_price_before_iva: number
  unit: string
  priority: number | null
  supplier: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

interface SelectedMaterial {
  material: MaterialOption
  quantity: number
}

interface Category {
  id: string
  name: string
}

interface MaterialPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItems: (items: SelectedMaterial[]) => Promise<void>
}

const ALL_CATEGORY_ID = "__all__"
const MANUAL_CATEGORY_ID = "__manual__"

export function MaterialPickerDialog({ open, onOpenChange, onAddItems }: MaterialPickerDialogProps) {
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY_ID)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SelectedMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Manual entry state
  const [manualName, setManualName] = useState("")
  const [manualUnit, setManualUnit] = useState("unidad")
  const [manualCost, setManualCost] = useState<number>(0)
  const [manualQty, setManualQty] = useState<number>(1)

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (selectedCategory !== ALL_CATEGORY_ID && selectedCategory !== MANUAL_CATEGORY_ID) {
        params.set("category_id", selectedCategory)
      }
      const res = await fetch(`/api/materials?${params}`)
      const data: MaterialOption[] = await res.json()
      setMaterials(data)

      // Extract unique categories from results when showing all
      if (selectedCategory === ALL_CATEGORY_ID && !search) {
        const catMap = new Map<string, Category>()
        data.forEach((m) => {
          if (m.category) catMap.set(m.category.id, m.category)
        })
        setCategories(Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory])

  useEffect(() => {
    if (open) loadMaterials()
  }, [open, loadMaterials])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelected([])
      setSearch("")
      setSelectedCategory(ALL_CATEGORY_ID)
      setManualName("")
      setManualUnit("unidad")
      setManualCost(0)
      setManualQty(1)
    }
  }, [open])

  const toggleMaterial = (material: MaterialOption) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.material.id === material.id)
      if (exists) return prev.filter((s) => s.material.id !== material.id)
      return [...prev, { material, quantity: 1 }]
    })
  }

  const updateQuantity = (materialId: string, delta: number) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.material.id === materialId
          ? { ...s, quantity: Math.max(0.01, parseFloat((s.quantity + delta).toFixed(2))) }
          : s
      )
    )
  }

  const setQuantityDirect = (materialId: string, value: number) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.material.id === materialId ? { ...s, quantity: Math.max(0.01, value) } : s
      )
    )
  }

  const addManualItem = () => {
    if (!manualName.trim() || manualCost <= 0) return
    const fakeId = `manual-${Date.now()}`
    const manualMaterial: MaterialOption = {
      id: fakeId,
      product_name: manualName,
      unit_price_before_iva: manualCost,
      unit: manualUnit,
      priority: null,
      supplier: null,
      category: null,
    }
    setSelected((prev) => [...prev, { material: manualMaterial, quantity: manualQty }])
    setManualName("")
    setManualCost(0)
    setManualQty(1)
  }

  const handleConfirm = async () => {
    if (selected.length === 0) return
    setSaving(true)
    try {
      await onAddItems(selected)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const totalCost = selected.reduce(
    (sum, s) => sum + s.material.unit_price_before_iva * s.quantity,
    0
  )

  const filteredMaterials =
    selectedCategory === MANUAL_CATEGORY_ID
      ? []
      : materials.filter((m) => {
          const matchesSearch =
            !search || m.product_name.toLowerCase().includes(search.toLowerCase())
          const matchesCategory =
            selectedCategory === ALL_CATEGORY_ID || m.category?.id === selectedCategory
          return matchesSearch && matchesCategory
        })

  // Group by category for the "all" view
  const grouped =
    selectedCategory === ALL_CATEGORY_ID && !search
      ? categories.map((cat) => ({
          category: cat,
          items: filteredMaterials.filter((m) => m.category?.id === cat.id),
        })).filter((g) => g.items.length > 0)
      : null

  const priorityColorClass = (priority: number | null) => {
    if (priority === 1) return "border-green-400 bg-green-50"
    if (priority === 2) return "border-yellow-400 bg-yellow-50"
    if (priority !== null) return "border-red-300 bg-red-50"
    return "border-gray-200 bg-white"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-lg">Agregar materiales a la receta</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar categorías */}
          <div className="w-48 shrink-0 border-r flex flex-col bg-muted/30">
            <div className="p-3 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categorías</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <button
                onClick={() => setSelectedCategory(ALL_CATEGORY_ID)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 rounded-none hover:bg-accent transition-colors ${
                  selectedCategory === ALL_CATEGORY_ID ? "bg-accent font-semibold" : ""
                }`}
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                Todos
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors ${
                    selectedCategory === cat.id ? "bg-accent font-semibold" : ""
                  }`}
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {cat.name}
                </button>
              ))}

              <div className="border-t mt-1 pt-1">
                <button
                  onClick={() => setSelectedCategory(MANUAL_CATEGORY_ID)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors ${
                    selectedCategory === MANUAL_CATEGORY_ID ? "bg-accent font-semibold" : ""
                  }`}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Manual
                </button>
              </div>
            </div>
          </div>

          {/* Panel principal */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedCategory !== MANUAL_CATEGORY_ID && (
              <div className="px-4 py-3 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {selectedCategory === MANUAL_CATEGORY_ID ? (
                /* Entrada manual */
                <div className="max-w-md space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Agrega un material que no está en cotizaciones existentes.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Nombre del material *</label>
                      <Input
                        placeholder="Ej: Tornillo 2 pulgadas"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Unidad</label>
                        <Input
                          placeholder="unidad, metro, kg..."
                          value={manualUnit}
                          onChange={(e) => setManualUnit(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Cantidad</label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={manualQty}
                          onChange={(e) => setManualQty(parseFloat(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Costo unitario (sin IVA, COP)</label>
                      <Input
                        type="number"
                        min="0"
                        value={manualCost}
                        onChange={(e) => setManualCost(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    {manualName && manualCost > 0 && (
                      <div className="rounded-md bg-muted p-3 text-sm flex justify-between">
                        <span className="text-muted-foreground">Costo de esta línea:</span>
                        <span className="font-semibold">{formatCOP(manualQty * manualCost)}</span>
                      </div>
                    )}
                    <Button
                      onClick={addManualItem}
                      disabled={!manualName.trim() || manualCost <= 0}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar a selección
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Cargando materiales...
                </div>
              ) : filteredMaterials.length === 0 && !grouped ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No se encontraron materiales
                </div>
              ) : grouped ? (
                /* Vista agrupada por categoría */
                <div className="space-y-6">
                  {grouped.map(({ category, items }) => (
                    <div key={category.id}>
                      <button
                        onClick={() => setSelectedCategory(category.id)}
                        className="flex items-center gap-2 mb-3 group"
                      >
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        {items.slice(0, 4).map((m) => (
                          <MaterialCard
                            key={m.id}
                            material={m}
                            isSelected={!!selected.find((s) => s.material.id === m.id)}
                            selectedQty={selected.find((s) => s.material.id === m.id)?.quantity}
                            onToggle={() => toggleMaterial(m)}
                            onQtyChange={(v) => setQuantityDirect(m.id, v)}
                            onQtyDelta={(d) => updateQuantity(m.id, d)}
                            priorityClass={priorityColorClass(m.priority)}
                          />
                        ))}
                        {items.length > 4 && (
                          <button
                            onClick={() => setSelectedCategory(category.id)}
                            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1"
                          >
                            <span>+{items.length - 4} más</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vista de categoría específica o búsqueda */
                <div className="grid grid-cols-2 gap-2">
                  {filteredMaterials.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      isSelected={!!selected.find((s) => s.material.id === m.id)}
                      selectedQty={selected.find((s) => s.material.id === m.id)?.quantity}
                      onToggle={() => toggleMaterial(m)}
                      onQtyChange={(v) => setQuantityDirect(m.id, v)}
                      onQtyDelta={(d) => updateQuantity(m.id, d)}
                      priorityClass={priorityColorClass(m.priority)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel de selección */}
          <div className="w-64 shrink-0 border-l flex flex-col bg-muted/10">
            <div className="p-3 border-b flex items-center gap-2 shrink-0">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Seleccionados ({selected.length})
              </p>
            </div>

            {selected.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Haz clic en los materiales para agregarlos a la receta
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {selected.map((s) => (
                    <div
                      key={s.material.id}
                      className="bg-white rounded-lg border p-2 text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium leading-tight line-clamp-2">
                          {s.material.product_name}
                        </p>
                        <button
                          onClick={() => toggleMaterial(s.material)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(s.material.id, -1)}
                          className="h-5 w-5 rounded border bg-muted flex items-center justify-center hover:bg-accent"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={s.quantity}
                          onChange={(e) =>
                            setQuantityDirect(s.material.id, parseFloat(e.target.value) || 0.01)
                          }
                          className="h-5 text-center text-xs px-1 flex-1"
                        />
                        <button
                          onClick={() => updateQuantity(s.material.id, 1)}
                          className="h-5 w-5 rounded border bg-muted flex items-center justify-center hover:bg-accent"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-muted-foreground shrink-0">{s.material.unit}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{formatCOP(s.material.unit_price_before_iva)}/u</span>
                        <span className="font-semibold text-foreground">
                          {formatCOP(s.material.unit_price_before_iva * s.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t shrink-0 space-y-1 bg-white">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal materiales:</span>
                    <span className="font-semibold text-foreground">{formatCOP(totalCost)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0 flex justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0 || saving}>
            {saving
              ? "Guardando..."
              : selected.length === 0
              ? "Agregar a receta"
              : `Agregar ${selected.length} material${selected.length > 1 ? "es" : ""} a receta`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---- Card de material ---- */
interface MaterialCardProps {
  material: MaterialOption
  isSelected: boolean
  selectedQty?: number
  onToggle: () => void
  onQtyChange: (v: number) => void
  onQtyDelta: (d: number) => void
  priorityClass: string
}

function MaterialCard({
  material,
  isSelected,
  selectedQty,
  onToggle,
  onQtyChange,
  onQtyDelta,
  priorityClass,
}: MaterialCardProps) {
  const pBadge = getPriorityBadge(material.priority)

  return (
    <div
      className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all select-none ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : `${priorityClass} hover:border-primary/40 hover:shadow-sm`
      }`}
      onClick={onToggle}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="pr-6">
        <p className="text-sm font-medium leading-tight line-clamp-2 mb-1">
          {material.product_name}
        </p>
        {material.supplier && (
          <p className="text-xs text-muted-foreground truncate">{material.supplier.name}</p>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-1">
        <div>
          <p className="text-sm font-bold text-foreground">{formatCOP(material.unit_price_before_iva)}</p>
          <p className="text-xs text-muted-foreground">/{material.unit}</p>
        </div>
        <span className="text-base" title={pBadge.label}>{pBadge.emoji}</span>
      </div>

      {isSelected && selectedQty !== undefined && (
        <div
          className="mt-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onQtyDelta(-1)}
            className="h-6 w-6 rounded border bg-white flex items-center justify-center hover:bg-muted text-xs"
          >
            <Minus className="h-3 w-3" />
          </button>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={selectedQty}
            onChange={(e) => onQtyChange(parseFloat(e.target.value) || 0.01)}
            className="h-6 text-center text-xs px-1 flex-1"
          />
          <button
            onClick={() => onQtyDelta(1)}
            className="h-6 w-6 rounded border bg-white flex items-center justify-center hover:bg-muted text-xs"
          >
            <Plus className="h-3 w-3" />
          </button>
          <span className="text-xs text-muted-foreground">{material.unit}</span>
        </div>
      )}
    </div>
  )
}
