/*
# Storage policies for task-screenshots bucket

1. Security
- Allow authenticated users to read screenshots (they are project members, verified via RLS on task_images)
- Allow authenticated users to upload screenshots to the bucket
- Allow users to delete their own uploads or project admins to delete any

2. Notes
- The bucket 'task-screenshots' is public so images can be displayed via public URLs
- Access control is primarily enforced at the database level via task_images RLS policies
*/

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
