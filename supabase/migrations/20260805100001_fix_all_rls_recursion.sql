/*
# Fix infinite recursion in all RLS policies referencing project_members

All policies that subquery project_members directly can trigger recursion
because project_members has its own RLS policies. Replace all direct
subqueries with SECURITY DEFINER helper functions that bypass RLS.
*/

-- projects
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(id, auth.uid())
  OR owner_id = auth.uid()
);

-- versions
DROP POLICY IF EXISTS "versions_select" ON versions;
CREATE POLICY "versions_select" ON versions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "versions_insert" ON versions;
CREATE POLICY "versions_insert" ON versions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);
DROP POLICY IF EXISTS "versions_update" ON versions;
CREATE POLICY "versions_update" ON versions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);
DROP POLICY IF EXISTS "versions_delete" ON versions;
CREATE POLICY "versions_delete" ON versions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);

-- tags
DROP POLICY IF EXISTS "tags_select" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "tags_insert" ON tags;
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "tags_delete" ON tags;
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);

-- tasks
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);

-- task_tags
DROP POLICY IF EXISTS "task_tags_select" ON task_tags;
CREATE POLICY "task_tags_select" ON task_tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_tags.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "task_tags_insert" ON task_tags;
CREATE POLICY "task_tags_insert" ON task_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_tags.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "task_tags_delete" ON task_tags;
CREATE POLICY "task_tags_delete" ON task_tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_tags.task_id AND public.is_project_member(t.project_id, auth.uid()))
);

-- task_images
DROP POLICY IF EXISTS "task_images_select" ON task_images;
CREATE POLICY "task_images_select" ON task_images FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_images.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "task_images_insert" ON task_images;
CREATE POLICY "task_images_insert" ON task_images FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_images.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "task_images_delete" ON task_images;
CREATE POLICY "task_images_delete" ON task_images FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_images.task_id AND public.is_project_admin(t.project_id, auth.uid()))
);

-- comments
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = comments.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = comments.task_id AND public.is_project_member(t.project_id, auth.uid()))
);
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = comments.task_id AND public.is_project_admin(t.project_id, auth.uid()))
);

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT TO authenticated USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_member(project_id, auth.uid())
);
