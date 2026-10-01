-- M3 P1-07: one row per signed events-webhook delivery, written by the edge
-- function with the service-role key. Counts and a short error code only: no
-- captions, payloads, signatures or sender addresses are ever stored here.
CREATE TABLE public.ingestion_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer text NOT NULL CHECK (producer ~ '^[a-z0-9@._-]{1,80}$'),
  run_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('succeeded','partial','duplicate','failed','rejected','heartbeat')),
  event_count int NOT NULL CHECK (event_count >= 0),
  inserted int NOT NULL DEFAULT 0 CHECK (inserted >= 0),
  duplicates int NOT NULL DEFAULT 0 CHECK (duplicates >= 0),
  invalid int NOT NULL DEFAULT 0 CHECK (invalid >= 0),
  items_seen int CHECK (items_seen >= 0),
  error_code text CHECK (error_code ~ '^[a-z0-9_]{1,64}$')
);
CREATE INDEX ingestion_deliveries_received ON public.ingestion_deliveries (received_at DESC);

ALTER TABLE public.ingestion_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ingestion_deliveries TO authenticated;
GRANT ALL ON public.ingestion_deliveries TO service_role;
CREATE POLICY ingestion_deliveries_admin_read ON public.ingestion_deliveries
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- The bucket already exists in hosted projects (baseline storage policies
-- reference it); this makes a local replay of image persistence complete.
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;
