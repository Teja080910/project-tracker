-- ============================================================
-- Enforce disabled user restrictions via RLS policies
-- ============================================================
-- Disabled users should not be able to read/write any data.
-- The profiles table has a special case: users must be able to
-- read their own profile (including the disabled flag) so the
-- auth context can detect disabled status and sign them out.
-- ============================================================

-- Helper: check if the current user is disabled
CREATE OR REPLACE FUNCTION public.is_user_disabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND disabled = true);
$$;

-- ============================================================
-- profiles: read own profile always, full access only if not disabled
-- ============================================================
DROP POLICY IF EXISTS "profiles_all_authenticated" ON profiles;
CREATE POLICY "profiles_select_own_or_not_disabled" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT public.is_user_disabled());

CREATE POLICY "profiles_insert_not_disabled" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_user_disabled());

CREATE POLICY "profiles_update_not_disabled" ON profiles
  FOR UPDATE TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

CREATE POLICY "profiles_delete_not_disabled" ON profiles
  FOR DELETE TO authenticated
  USING (NOT public.is_user_disabled());

-- ============================================================
-- All other tables: block disabled users entirely
-- ============================================================

-- roles (read-only)
DROP POLICY IF EXISTS "roles_read_authenticated" ON roles;
CREATE POLICY "roles_read_not_disabled" ON roles
  FOR SELECT TO authenticated
  USING (NOT public.is_user_disabled());

-- projects
DROP POLICY IF EXISTS "projects_all_authenticated" ON projects;
CREATE POLICY "projects_all_not_disabled" ON projects
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- project_members
DROP POLICY IF EXISTS "project_members_all_authenticated" ON project_members;
CREATE POLICY "project_members_all_not_disabled" ON project_members
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- versions
DROP POLICY IF EXISTS "versions_all_authenticated" ON versions;
CREATE POLICY "versions_all_not_disabled" ON versions
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- tags
DROP POLICY IF EXISTS "tags_all_authenticated" ON tags;
CREATE POLICY "tags_all_not_disabled" ON tags
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- tasks
DROP POLICY IF EXISTS "tasks_all_authenticated" ON tasks;
CREATE POLICY "tasks_all_not_disabled" ON tasks
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- task_tags
DROP POLICY IF EXISTS "task_tags_all_authenticated" ON task_tags;
CREATE POLICY "task_tags_all_not_disabled" ON task_tags
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- task_images
DROP POLICY IF EXISTS "task_images_all_authenticated" ON task_images;
CREATE POLICY "task_images_all_not_disabled" ON task_images
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- comments
DROP POLICY IF EXISTS "comments_all_authenticated" ON comments;
CREATE POLICY "comments_all_not_disabled" ON comments
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- notifications
DROP POLICY IF EXISTS "notifications_all_authenticated" ON notifications;
CREATE POLICY "notifications_all_not_disabled" ON notifications
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_all_authenticated" ON activity_logs;
CREATE POLICY "activity_logs_all_not_disabled" ON activity_logs
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

-- ============================================================
-- Storage: block disabled users from uploading/viewing files
-- ============================================================

DROP POLICY IF EXISTS "screenshots_read" ON storage.objects;
CREATE POLICY "screenshots_read_not_disabled" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-screenshots' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "screenshots_insert" ON storage.objects;
CREATE POLICY "screenshots_insert_not_disabled" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-screenshots' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "screenshots_delete" ON storage.objects;
CREATE POLICY "screenshots_delete_not_disabled" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-screenshots' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read_not_disabled" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert_not_disabled" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete_not_disabled" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND NOT public.is_user_disabled());

-- APKs bucket (read is public for anon, write/delete only for non-disabled)
DROP POLICY IF EXISTS "apks_bucket_read" ON storage.objects;
CREATE POLICY "apks_bucket_read_not_disabled" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'apks');

DROP POLICY IF EXISTS "apks_bucket_write" ON storage.objects;
CREATE POLICY "apks_bucket_write_not_disabled" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apks' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "apks_bucket_delete" ON storage.objects;
CREATE POLICY "apks_bucket_delete_not_disabled" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'apks' AND NOT public.is_user_disabled());
