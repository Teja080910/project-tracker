/*
# Fix infinite recursion in project_members RLS policies

The original policies self-referenced project_members in subqueries,
causing infinite recursion. This migration replaces them with a
SECURITY DEFINER function that bypasses RLS.
*/

-- Create a helper function that checks project membership without RLS
CREATE OR REPLACE FUNCTION public.is_project_member(project_id uuid, user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = $1 AND user_id = $2);
$$;

-- Create a helper function that checks project admin role without RLS
CREATE OR REPLACE FUNCTION public.is_project_admin(project_id uuid, user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = $1 AND user_id = $2 AND role = 'project_admin');
$$;

-- Drop old policies on project_members
DROP POLICY IF EXISTS "pm_select" ON project_members;
DROP POLICY IF EXISTS "pm_insert" ON project_members;
DROP POLICY IF EXISTS "pm_update" ON project_members;
DROP POLICY IF EXISTS "pm_delete" ON project_members;

-- Recreate policies using the helper functions
CREATE POLICY "pm_select" ON project_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR user_id = auth.uid()
  OR public.is_project_member(project_id, auth.uid())
);

CREATE POLICY "pm_insert" ON project_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);

CREATE POLICY "pm_update" ON project_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);

CREATE POLICY "pm_delete" ON project_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR public.is_project_admin(project_id, auth.uid())
);
