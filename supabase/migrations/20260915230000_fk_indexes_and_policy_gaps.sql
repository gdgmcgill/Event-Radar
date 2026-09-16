-- =============================================================================
-- 20260915230000_fk_indexes_and_policy_gaps.sql
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
-- Requirement REFAC-02
--
-- CLOSES: F-015 (events.status, the predicate column of the anonymous feed
--         policy, has no index)
--         F-016 (club-invitation acceptance is broken in production because the
--         invitee policies exist only in an unapplied migration)
--         F-020 (four policy-referenced columns on featured_events and
--         moderation_reviews have no index)
--         F-049 (events_tests — created out of band, dropped out of band, its
--         cleanup migration never applied)
--
-- IDEMPOTENT BY CONSTRUCTION. Every index carries an if-not-exists guard, the
-- orphaned-table drop carries an if-exists guard, and every policy is dropped
-- if present immediately before it is created. Applying this file twice
-- produces the same schema as applying it once.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN — and why
--
--   The nine foreign-key indexes declared by the archived, never-applied
--   `20260316000004_fk_indexes_and_cleanup.sql` are NOT re-issued here. Plan
--   03-01 measured that production's history row `20260316101601` already
--   declares the same nine index names, and plan 03-04 confirmed all nine are
--   present in `20260915214553_baseline.sql`:
--
--     idx_club_invitations_inviter_id      idx_feedback_user_id
--     idx_event_reports_reviewed_by        idx_notifications_club_id
--     idx_featured_clubs_club_id           idx_organizer_requests_reviewed_by
--     idx_featured_clubs_created_by        idx_users_banned_by
--     idx_featured_events_created_by
--
--   Re-issuing them would be dead SQL that misrepresents the state of the
--   database. REFAC-02's real index targets are the ones below, measured from
--   the live schema rather than inherited from the archived file's title.
--
--   The full 41-versus-24 policy divergence (`rls-review.md` § 6, finding 7) is
--   NOT addressed here. That is 60 policies wide and belongs to Phase 5. Only
--   the audit-named gap REFAC-02 covers — F-016's three club_invitations
--   policies — is closed.
--
-- POLICY STYLE. Every policy this file writes names its target role with a TO
-- clause and wraps its auth-uid call in a scalar subquery. The two deprecated
-- forms the tree is full of — 61 of 101 live policies carry no TO clause
-- (finding 13) and 68 unwrapped auth-uid occurrences span 59 policies
-- (finding 14) — are neither fixed nor propagated by this migration. Fixing
-- them across the inherited policy set is Phase 5's work.
-- =============================================================================


-- =============================================================================
-- 1. Policy-predicate indexes — F-015, F-020
--
--    A policy predicate runs per candidate row. A predicate on a column the
--    planner cannot index turns every row-level check into a sequential scan,
--    and for the anonymous feed that cost is paid on behalf of an
--    unauthenticated caller before any row is returned.
-- =============================================================================

-- F-015. `Approved events are viewable by everyone` is USING (status = 'approved')
-- and `events` is the largest and most-read table in the product. None of its
-- seven existing indexes covers `status`. The audit (rls-review.md § 5)
-- recommends a composite that serves the policy and the feed's ordering
-- together, partial on the soft-delete predicate the feed also carries.
CREATE INDEX IF NOT EXISTS idx_events_status_start_date
  ON public.events (status, start_date)
  WHERE (deleted_at IS NULL);

-- F-020. `Public can read active featured events` is
-- USING (starts_at <= now() AND ends_at > now()) — both halves unindexed, and
-- the read is anonymous. One composite serves the whole AND-ed window.
CREATE INDEX IF NOT EXISTS idx_featured_events_window
  ON public.featured_events (starts_at, ends_at);

-- F-020. `Creators can appeal their items` is a write-path check on the author
-- and action columns together. The table's only non-primary index is
-- (target_type, target_id, created_at), which covers neither of them.
CREATE INDEX IF NOT EXISTS idx_moderation_reviews_author_action
  ON public.moderation_reviews (author_id, action);

-- rls-review.md § 5, adjacent observation. Not a policy-performance finding —
-- no policy references it — but an unindexed foreign-key-shaped column on a
-- table that already carries four other indexes. Recorded there as a REFAC-01
-- input and closed here because it belongs to the same slice.
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_event_id
  ON public.recommendation_feedback (event_id);


-- =============================================================================
-- 2. Trigram indexes for public.search_events_fuzzy
--
--    Measured, not inherited: `public.events` carries NO trigram index in
--    production, and `public.search_events_fuzzy` calls similarity() and the
--    `%` operator against `title` and `description`. Without a trigram index
--    every fuzzy search is a per-row sequential scan computing trigram
--    similarity in the executor. The archived `20260308000001_fuzzy_search.sql`
--    declared both indexes; its version was never applied, so production has
--    the function without the indexes it was written for.
--
--    pg_trgm is already created by the baseline (D-17), so these indexes have
--    their operator class available at apply time.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON public.events USING gin (title public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_description_trgm
  ON public.events USING gin (description public.gin_trgm_ops);


-- =============================================================================
-- 3. Orphaned relation cleanup — F-049
--
--    `events_tests` was created out of band and dropped out of band; it exists
--    in neither production nor the baseline, and its only repository trace is
--    a hand-edited entry in the generated types file. The drop is re-issued
--    here so a rebuilt environment cannot inherit it from anywhere, and it is
--    a guarded no-op against every environment that already lacks it.
-- =============================================================================

DROP TABLE IF EXISTS public.events_tests;


-- =============================================================================
-- 4. club_invitations policy gaps — F-016
--
--    `public.club_invitations` carries exactly two live policies, both
--    `is_club_owner(club_id)`: one INSERT, one SELECT. An invitee can neither
--    see nor accept their own invitation. `/api/clubs/[id]/invites` is
--    RLS-reliant (uses_service_client: false), so nothing masks this —
--    club-invitation acceptance is broken in production today.
--
--    The content below is re-issued from the archived, never-applied
--    `20260226000001_invitee_select_update_policy.sql`. The archived file stays
--    archived; only its content travels.
-- =============================================================================

-- SELECT gap. Without this policy the invitee's own invitation is invisible to
-- them, and because an UPDATE must first find its row through a SELECT policy,
-- its absence also silently reduces the accept path to zero rows affected —
-- the same invisible-failure family this phase exists to end.
DROP POLICY IF EXISTS "Invitees can view their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can view their own invitations"
  ON public.club_invitations
  FOR SELECT
  TO authenticated
  USING (
    invitee_email = (SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid()))
  );

-- UPDATE gap: the accept transition itself. USING scopes the rows an invitee
-- may touch to their own pending invitations; WITH CHECK constrains what the
-- row may become, so the clause pair is what stops an invitee editing an
-- invitation into any other state — or onto anyone else's email.
DROP POLICY IF EXISTS "Invitees can accept their own invitations" ON public.club_invitations;
CREATE POLICY "Invitees can accept their own invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (
    invitee_email = (SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND status = 'pending'
  )
  WITH CHECK (
    invitee_email = (SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND status = 'accepted'
  );

-- UPDATE gap: the owner's revoke transition (MEM-08). Production grants club
-- owners INSERT and SELECT on this table but no UPDATE at all, so an owner
-- cannot withdraw an invitation they sent. `is_club_owner` is the baseline's
-- own SECURITY DEFINER helper, already granted to `authenticated`; no new
-- definer function is introduced by this migration.
DROP POLICY IF EXISTS "Club owners can update club invitations" ON public.club_invitations;
CREATE POLICY "Club owners can update club invitations"
  ON public.club_invitations
  FOR UPDATE
  TO authenticated
  USING (public.is_club_owner(club_id) AND status = 'pending')
  WITH CHECK (public.is_club_owner(club_id) AND status = 'revoked');
