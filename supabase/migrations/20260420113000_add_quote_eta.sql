-- Add per-quote ETA text so PDF ETA line can be customized.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS eta_text TEXT;
