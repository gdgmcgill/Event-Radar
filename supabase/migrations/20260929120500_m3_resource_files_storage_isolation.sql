-- M3 P1-08 fix round 1, CRITICAL: the private resource-files bucket must not
-- be reachable through the generic "own folder" / "public read" storage
-- policies from the baseline. The baseline's "Allow public read access
-- 1oj01fe_0" SELECT policy has no bucket filter at all (USING (true) for
-- every authenticated caller), and the three "own folder" INSERT/UPDATE/
-- DELETE policies key on (storage.foldername(name))[1] = auth.uid()::text —
-- resources are keyed by resource id, not actor id, but nothing stops a
-- caller whose own uid happens to prefix a resource path, or a future bucket
-- reuse, from riding these generic rules. 20260927220050 already narrowed
-- them once for club-logos (ALTER POLICY, not DROP/CREATE, to preserve every
-- other grant on the same policy); this repeats that pattern for
-- resource-files. Only the service role (getElevatedClient, via
-- resource-files' own lack of any storage.objects policy) reads or writes
-- this bucket now.

ALTER POLICY "Allow authenticated upload to own folder" ON storage.objects
  WITH CHECK (bucket_id NOT IN ('club-logos', 'resource-files')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Allow authenticated update in own folder" ON storage.objects
  USING (bucket_id NOT IN ('club-logos', 'resource-files')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id NOT IN ('club-logos', 'resource-files')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Allow authenticated delete from own folder" ON storage.objects
  USING (bucket_id NOT IN ('club-logos', 'resource-files')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Allow public read access 1oj01fe_0" ON storage.objects
  USING (bucket_id <> 'resource-files');
