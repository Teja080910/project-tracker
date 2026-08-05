-- Fix foreign keys on tasks table to reference profiles instead of auth.users
-- This allows Supabase's auto-detection of foreign key relationships for joins like profiles!assignee_id

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reporter_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES profiles(id);
