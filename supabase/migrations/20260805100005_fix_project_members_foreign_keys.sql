-- Fix foreign keys on project_members and projects to reference profiles instead of auth.users
-- This allows Supabase's auto-detection of foreign key relationships for joins like profile:profiles(*)

ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE project_members ADD CONSTRAINT project_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id);
