-- Create task-screenshots bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('task-screenshots', 'task-screenshots', true, false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read (view) screenshots
DROP POLICY IF EXISTS "screenshots_read" ON storage.objects;
CREATE POLICY "screenshots_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'task-screenshots');

-- Allow authenticated users to upload screenshots
DROP POLICY IF EXISTS "screenshots_insert" ON storage.objects;
CREATE POLICY "screenshots_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-screenshots');

-- Allow authenticated users to delete screenshots
DROP POLICY IF EXISTS "screenshots_delete" ON storage.objects;
CREATE POLICY "screenshots_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-screenshots');
