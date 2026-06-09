-- Per line: blockout (BO) or screen — shown in PDF BO/SHEER column and section grouping.
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS blind_type TEXT NOT NULL DEFAULT 'blockout';

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_blind_type_check;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_blind_type_check
  CHECK (blind_type IN ('blockout', 'screen'));
