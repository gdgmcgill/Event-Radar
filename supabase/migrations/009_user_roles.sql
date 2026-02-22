-- =============================================
-- User Roles & Permissions Migration
-- Replace is_admin boolean with multi-role system
-- =============================================

-- =============================================
-- 1. ROLE ENUM AND USERS TABLE MIGRATION
-- =============================================

-- Create role enum type
CREATE TYPE user_role AS ENUM ('user', 'club_organizer', 'admin');

-- Add roles array column to users table
ALTER TABLE public.users
  ADD COLUMN roles user_role[] NOT NULL DEFAULT '{user}';

-- Migrate existing admins
UPDATE public.users SET roles = '{user, admin}' WHERE is_admin = true;
UPDATE public.users SET roles = '{user}' WHERE is_admin = false OR is_admin IS NULL;

-- Drop the old boolean column
ALTER TABLE public.users DROP COLUMN is_admin;

-- Index for role-based queries (GIN index for array containment checks)
CREATE INDEX IF NOT EXISTS idx_users_roles ON public.users USING GIN(roles);

-- =============================================
-- 2. CLUB MEMBERS TABLE (many-to-many)
-- Links users to clubs they organize
-- =============================================

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'organizer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);

-- =============================================
-- 3. ORGANIZER REQUESTS TABLE
-- Self-serve request flow for club organizer access
-- =============================================

CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_requests_status ON public.organizer_requests(status);
CREATE INDEX IF NOT EXISTS idx_organizer_requests_user ON public.organizer_requests(user_id);

-- Auto-update updated_at on organizer_requests
CREATE TRIGGER update_organizer_requests_updated_at
  BEFORE UPDATE ON public.organizer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =============================================

-- ----- Club Members -----
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memberships"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage memberships"
  ON public.club_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

-- ----- Organizer Requests -----
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests"
  ON public.organizer_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own requests"
  ON public.organizer_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage requests"
  ON public.organizer_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

-- =============================================
-- 5. COMMENTS
-- =============================================
COMMENT ON TABLE public.club_members IS 'Many-to-many linking users to clubs they organize';
COMMENT ON TABLE public.organizer_requests IS 'Self-serve requests for club organizer access';
COMMENT ON COLUMN public.users.roles IS 'Array of user roles: user, club_organizer, admin';
