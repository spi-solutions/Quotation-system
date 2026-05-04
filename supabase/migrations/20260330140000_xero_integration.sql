-- Xero: link customers and quotes; store sync errors
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS xero_contact_id TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS xero_sync_error TEXT;
