-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORÍAS
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO categories (name) VALUES
  ('Muebles'), ('Maderas'), ('Telas / Textiles'), ('Iluminación'),
  ('Herrajes / Accesorios'), ('Pisos / Revestimientos'), ('Pintura / Acabados');

-- 2. PROVEEDORES
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. COTIZACIONES DE PROVEEDOR
CREATE TABLE supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  quote_reference TEXT,
  quote_date DATE NOT NULL,
  expiry_date DATE,
  pdf_storage_path TEXT,
  raw_text TEXT,
  subtotal_before_iva NUMERIC(15,2),
  iva_amount NUMERIC(15,2),
  total_with_iva NUMERIC(15,2),
  currency TEXT DEFAULT 'COP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','partial','rejected')),
  source TEXT DEFAULT 'web' CHECK (source IN ('web','telegram')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ÍTEMS DE COTIZACIÓN DE PROVEEDOR
CREATE TABLE supplier_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_quote_id UUID REFERENCES supplier_quotes(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  category_id UUID REFERENCES categories(id),
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'unidad',
  unit_price_before_iva NUMERIC(15,2) NOT NULL,
  total_before_iva NUMERIC(15,2) NOT NULL,
  priority INTEGER,
  is_approved BOOLEAN DEFAULT false,
  quote_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_items_product_name ON supplier_quote_items(product_name);
CREATE INDEX idx_quote_items_category ON supplier_quote_items(category_id);
CREATE INDEX idx_quote_items_supplier ON supplier_quote_items(supplier_id);

-- 5. PRODUCTOS VENDIBLES
CREATE TABLE sellable_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  margin_percentage NUMERIC(5,2) NOT NULL DEFAULT 45.00,
  iva_percentage NUMERIC(5,2) NOT NULL DEFAULT 19.00,
  additional_costs NUMERIC(15,2) DEFAULT 0,
  production_cost NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  sale_price_before_iva NUMERIC(15,2),
  iva_amount NUMERIC(15,2),
  sale_price_with_iva NUMERIC(15,2),
  profit_per_unit NUMERIC(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RECETAS DE PRODUCTO
CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_product_id UUID REFERENCES sellable_products(id) ON DELETE CASCADE,
  supplier_quote_item_id UUID REFERENCES supplier_quote_items(id),
  material_name TEXT NOT NULL,
  material_category_id UUID REFERENCES categories(id),
  quantity_needed NUMERIC(10,4) NOT NULL,
  unit TEXT DEFAULT 'unidad',
  unit_cost NUMERIC(15,2),
  line_cost NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recipes_product ON product_recipes(sellable_product_id);
CREATE INDEX idx_recipes_quote_item ON product_recipes(supplier_quote_item_id);

-- 7. COTIZACIONES PARA CLIENTES
CREATE TABLE client_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  quote_date DATE DEFAULT CURRENT_DATE,
  validity_days INTEGER DEFAULT 30,
  subtotal_before_iva NUMERIC(15,2),
  iva_percentage NUMERIC(5,2) DEFAULT 19.00,
  iva_amount NUMERIC(15,2),
  total_with_iva NUMERIC(15,2),
  pdf_storage_path TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM client_quotes;
  NEW.quote_number := 'COT-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON client_quotes
  FOR EACH ROW WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
  EXECUTE FUNCTION generate_quote_number();

-- 8. ÍTEMS DE COTIZACIÓN AL CLIENTE
CREATE TABLE client_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_quote_id UUID REFERENCES client_quotes(id) ON DELETE CASCADE,
  sellable_product_id UUID REFERENCES sellable_products(id),
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'unidad',
  production_cost NUMERIC(15,2) NOT NULL,
  margin_percentage NUMERIC(5,2) NOT NULL,
  sale_unit_price NUMERIC(15,2) NOT NULL,
  sale_total NUMERIC(15,2) NOT NULL,
  profit NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FUNCIÓN: Recalcular precios de producto vendible
CREATE OR REPLACE FUNCTION recalculate_sellable_product(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_production_cost NUMERIC(15,2);
  v_total_cost NUMERIC(15,2);
  v_sale_before_iva NUMERIC(15,2);
  v_iva NUMERIC(15,2);
  v_margin NUMERIC(5,2);
  v_iva_pct NUMERIC(5,2);
  v_additional NUMERIC(15,2);
BEGIN
  SELECT COALESCE(SUM(line_cost), 0) INTO v_production_cost
  FROM product_recipes WHERE sellable_product_id = p_product_id;

  SELECT margin_percentage, iva_percentage, COALESCE(additional_costs, 0)
  INTO v_margin, v_iva_pct, v_additional
  FROM sellable_products WHERE id = p_product_id;

  v_total_cost := v_production_cost + v_additional;

  IF v_margin >= 100 THEN
    v_margin := 99;
  END IF;

  v_sale_before_iva := v_total_cost / (1 - v_margin / 100);
  v_iva := v_sale_before_iva * v_iva_pct / 100;

  UPDATE sellable_products SET
    production_cost = v_production_cost,
    total_cost = v_total_cost,
    sale_price_before_iva = v_sale_before_iva,
    iva_amount = v_iva,
    sale_price_with_iva = v_sale_before_iva + v_iva,
    profit_per_unit = v_sale_before_iva - v_total_cost,
    updated_at = now()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- FUNCIÓN: Recalcular prioridades
CREATE OR REPLACE FUNCTION recalculate_priorities(p_product_name TEXT)
RETURNS VOID AS $$
BEGIN
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(product_name))
        ORDER BY unit_price_before_iva ASC
      ) AS new_priority
    FROM supplier_quote_items
    WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(p_product_name))
      AND is_approved = true
  )
  UPDATE supplier_quote_items SET priority = ranked.new_priority
  FROM ranked WHERE supplier_quote_items.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies (básicas para un solo usuario admin)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellable_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_quote_items ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados pueden hacer todo
CREATE POLICY "Auth users full access" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON supplier_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON supplier_quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON sellable_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON product_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON client_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON client_quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass
CREATE POLICY "Service role bypass" ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON supplier_quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON supplier_quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON sellable_products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON product_recipes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON client_quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass" ON client_quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);
