/*
# Create shipping_labels table (single-tenant, no auth)

1. Overview
This migration creates the core `shipping_labels` table for a logistics label
printing application. The app is single-tenant (no sign-in screen), so labels
are intentionally shared/public across the anon-key frontend. This supports a
warehouse workstation scenario where one shared device is used to print labels.

2. New Tables
- `shipping_labels`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `tracking_id` (text, not null) — the courier tracking number
  - `receiver_name` (text, not null)
  - `receiver_address` (text, not null)
  - `receiver_phone` (text, nullable) — optional contact number
  - `receiver_city` (text, nullable) — optional city for sorting
  - `receiver_postal_code` (text, nullable) — optional postal/ZIP code
  - `receiver_country` (text, nullable, default 'United States')
  - `sender_name` (text, nullable) — optional sender info
  - `sender_address` (text, nullable)
  - `sender_phone` (text, nullable)
  - `courier_name` (text, nullable) — e.g. FedEx, UPS, DHL
  - `courier_service` (text, nullable) — e.g. Express, Ground
  - `weight` (text, nullable) — package weight (kept as text for unit suffix)
  - `dimensions` (text, nullable) — package dimensions
  - `notes` (text, nullable) — internal notes
  - `label_size` (text, not null, default '100x150') — size key
  - `barcode_type` (text, not null, default 'CODE128')
  - `status` (text, not null, default 'created') — created | printed | archived
  - `print_count` (integer, not null, default 0)
  - `last_printed_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

3. Indexes
- `idx_shipping_labels_tracking_id` on `tracking_id` for search by tracking number
- `idx_shipping_labels_courier_name` on `courier_name` for filter by courier
- `idx_shipping_labels_status` on `status` for filter by status
- `idx_shipping_labels_created_at` on `created_at` desc for history sorting

4. Security
- Enable RLS on `shipping_labels`.
- Allow anon + authenticated full CRUD because the data is intentionally
  shared/public (single-tenant warehouse workstation app, no sign-in screen).

5. Important Notes
1. This is a single-tenant schema — no user_id column, no auth dependency.
2. Policies use `USING (true)` / `WITH CHECK (true)` because the data is
   intentionally public/shared across the anon-key frontend.
3. `updated_at` is maintained by the application; no trigger is added here to
   keep the migration minimal and idempotent.
4. The `status` column is a free-text enum managed by the application layer
   (created | printed | archived). No DB-level constraint is added so the
   app can evolve statuses without a migration.
*/

CREATE TABLE IF NOT EXISTS shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text NOT NULL,
  receiver_name text NOT NULL,
  receiver_address text NOT NULL,
  receiver_phone text,
  receiver_city text,
  receiver_postal_code text,
  receiver_country text DEFAULT 'United States',
  sender_name text,
  sender_address text,
  sender_phone text,
  courier_name text,
  courier_service text,
  weight text,
  dimensions text,
  notes text,
  label_size text NOT NULL DEFAULT '100x150',
  barcode_type text NOT NULL DEFAULT 'CODE128',
  status text NOT NULL DEFAULT 'created',
  print_count integer NOT NULL DEFAULT 0,
  last_printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_id
  ON shipping_labels (tracking_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_courier_name
  ON shipping_labels (courier_name);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status
  ON shipping_labels (status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at
  ON shipping_labels (created_at DESC);

ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_labels" ON shipping_labels;
CREATE POLICY "anon_select_labels" ON shipping_labels FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_labels" ON shipping_labels;
CREATE POLICY "anon_insert_labels" ON shipping_labels FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_labels" ON shipping_labels;
CREATE POLICY "anon_update_labels" ON shipping_labels FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_labels" ON shipping_labels;
CREATE POLICY "anon_delete_labels" ON shipping_labels FOR DELETE
  TO anon, authenticated USING (true);
