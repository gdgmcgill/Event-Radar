CREATE TABLE public.event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (inviter_id, invitee_id, event_id)
);

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Users can see invites they sent or received
CREATE POLICY "Users can view own invites"
  ON public.event_invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create invites
CREATE POLICY "Users can send invites"
  ON public.event_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE INDEX idx_event_invites_invitee ON public.event_invites(invitee_id);
CREATE INDEX idx_event_invites_event ON public.event_invites(event_id);
