-- Create the event-images storage bucket (public, for scraped event images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to event images
CREATE POLICY "Public read access for event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Allow service role to upload event images
CREATE POLICY "Service role upload for event images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'event-images');
