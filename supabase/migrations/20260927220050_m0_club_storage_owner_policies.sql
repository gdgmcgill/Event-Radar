-- M0 / F-030: club logos AND club banners use club-logos/<club-id>/... .
-- Both application routes authorize current club owners on the cookie client.
-- Reproduce that boundary at Storage so a direct API caller cannot bypass it.
-- Policies are permissive/OR, so the generic user-folder rules must exclude
-- this bucket too (a club UUID can equal a user's UUID).

ALTER POLICY "Allow authenticated upload to own folder" ON storage.objects
  WITH CHECK (bucket_id <> 'club-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Allow authenticated update in own folder" ON storage.objects
  USING (bucket_id <> 'club-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id <> 'club-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Allow authenticated delete from own folder" ON storage.objects
  USING (bucket_id <> 'club-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can upload club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update club logos" ON storage.objects;

CREATE POLICY "Club owners can upload club branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS membership
      WHERE membership.club_id::text = (storage.foldername(name))[1]
        AND membership.user_id = (SELECT auth.uid())
        AND membership.role = 'owner'
    )
  );
CREATE POLICY "Club owners can update club branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS membership
      WHERE membership.club_id::text = (storage.foldername(name))[1]
        AND membership.user_id = (SELECT auth.uid())
        AND membership.role = 'owner'
    )
  )
  WITH CHECK (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS membership
      WHERE membership.club_id::text = (storage.foldername(name))[1]
        AND membership.user_id = (SELECT auth.uid())
        AND membership.role = 'owner'
    )
  );
-- Public SELECT policies stay in place, enabling upload(upsert: true).
-- No client DELETE permission is introduced for club branding.
