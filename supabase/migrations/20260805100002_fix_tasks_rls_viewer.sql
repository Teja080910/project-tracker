/*
# Fix tasks RLS to exclude viewers from insert/update

Viewers should have read-only access. The current tasks_insert and tasks_update
policies allow any project member (including viewers) to create and update tasks.
This migration restricts insert/update to non-viewer members.
*/

-- Create a helper function that checks if user is a project member with a non-viewer role
CREATE OR REPLACE FUNCTION public.is_project_contributor(project_id uuid, user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = $1 AND user_id = $2 AND role != 'viewer'
  );
$$;

-- Fix tasks_insert: exclude viewers
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_contributor(project_id, auth.uid())
);

-- Fix tasks_update: exclude viewers
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_contributor(project_id, auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_contributor(project_id, auth.uid())
);
