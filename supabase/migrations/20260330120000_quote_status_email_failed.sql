-- Allow quotes whose email send failed to be stored distinctly from successfully sent quotes.
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('Draft', 'Sent', 'Approved', 'Invoiced', 'EmailFailed'));
