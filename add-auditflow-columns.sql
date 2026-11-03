-- AuditFlow integration (pilot). Idempotent: safe to run more than once.
-- Run in the Supabase SQL editor (or psql) BEFORE enabling AUDITFLOW_URL / AUDITFLOW_API_KEY.

ALTER TABLE products ADD COLUMN IF NOT EXISTS auditflow_id TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS auditflow_sku TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS auditflow_order_id TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auditflow_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auditflow_status TEXT;
-- Vanda's total/subtotal columns hold 2 decimals; AuditFlow works in 3 (dinars). Keep the exact amount charged.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auditflow_total NUMERIC(12,3);

-- Webhook de-duplication: AuditFlow delivers at least once.
CREATE TABLE IF NOT EXISTS auditflow_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Only the backend (service role, which bypasses RLS) touches it.
ALTER TABLE auditflow_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_products_auditflow_id ON products(auditflow_id);
CREATE INDEX IF NOT EXISTS idx_orders_auditflow_order_id ON orders(auditflow_order_id);

-- Droit de timbre fiscal affiché au checkout (TND), lu par le frontend. 0 pour le masquer.
INSERT INTO parametres (key, value, description, type)
VALUES ('timbre_fiscal', '1.00', 'Droit de timbre fiscal ajouté à chaque facture (TND)', 'decimal')
ON CONFLICT (key) DO NOTHING;
