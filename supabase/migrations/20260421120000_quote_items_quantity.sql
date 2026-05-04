-- Per-line quantity for quote items (default 1 for existing rows).
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_quantity_check;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_quantity_check CHECK (quantity >= 1);
