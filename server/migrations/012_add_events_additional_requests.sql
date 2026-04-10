-- Migration: Add additional_requests JSON payload for fest event request modules

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS additional_requests JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.events
SET additional_requests = '{}'::jsonb
WHERE additional_requests IS NULL;
