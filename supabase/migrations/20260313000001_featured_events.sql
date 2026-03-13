-- Featured events / sponsored promotions
CREATE TABLE featured_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_name text,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_events_date_order CHECK (ends_at > starts_at)
);

-- Only one active/upcoming featured entry per event
CREATE UNIQUE INDEX featured_events_active_event
  ON featured_events (event_id) WHERE ends_at > now();

-- RLS
ALTER TABLE featured_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active featured events"
  ON featured_events FOR SELECT
  USING (starts_at <= now() AND ends_at > now());

CREATE POLICY "Admins can manage featured events"
  ON featured_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND 'admin' = ANY(users.roles)
    )
  );
