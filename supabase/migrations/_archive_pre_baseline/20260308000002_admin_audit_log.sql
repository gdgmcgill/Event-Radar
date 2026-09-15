CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'created', 'updated', 'deleted', 'bulk_approved', 'bulk_rejected')),
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'user', 'club')),
  target_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- RLS: only admins can read audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND 'admin' = ANY(u.roles)
    )
  );

-- Service role can insert (used by admin API routes)
CREATE POLICY "Service role can insert audit log"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (true);
