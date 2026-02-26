-- Phase 7: Add invitee-access SELECT and UPDATE policies on club_invitations
-- Allows invitation recipients to read and accept their own invitations
-- Deferred from Phase 5 per STATE.md decision

-- SELECT: invitees can view their own invitations (by email match)
DROP POLICY IF EXISTS "Invitees can view their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can view their own invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM public.users WHERE id = (SELECT auth.uid()))
  );

-- UPDATE: invitees can accept their own pending invitations (status transition only)
DROP POLICY IF EXISTS "Invitees can accept their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can accept their own invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM public.users WHERE id = (SELECT auth.uid()))
    AND status = 'pending'
  )
  WITH CHECK (
    status = 'accepted'
  );

-- UPDATE: owners can revoke pending invitations for their club (MEM-08)
DROP POLICY IF EXISTS "Club owners can update club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can update club invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (is_club_owner(club_id) AND status = 'pending')
  WITH CHECK (status = 'revoked');
