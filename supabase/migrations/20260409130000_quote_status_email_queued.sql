-- Distinguish provider-accepted email from inbox-delivered email.
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('Draft', 'EmailQueued', 'Sent', 'Approved', 'Invoiced', 'EmailFailed'));

