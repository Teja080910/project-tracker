/*
# Project & Issue Management System — schema (idempotent)

Safe to run multiple times — every statement is guarded with
IF NOT EXISTS / DROP ... IF EXISTS / ON CONFLICT.

- 12 tables with FKs, CHECK constraints, and indexes
- triggers: auto-create profile on signup, updated_at maintenance,
  slug generation, role-change protection
- basic security: RLS enabled with a single permissive policy per table
  (authenticated users only — anon key has no access)
- storage buckets: task-screenshots, avatars
*/

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text
);

INSERT INTO roles (id, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full access to everything'),
  ('project_admin', 'Project Admin', 'Manages assigned projects'),
  ('developer', 'Developer', 'Works on assigned tasks'),
  ('tester', 'Tester', 'Creates bugs, issues, stories'),
  ('viewer', 'Viewer', 'Read-only access')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'viewer' REFERENCES roles(id),
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  client_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'developer' REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  release_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT 'gray',
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES versions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'task' CHECK (type IN ('task','bug','story','issue')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS task_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(btrim(message)) > 0),
  image_path text,
  file_type text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS file_name text;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  priority text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority text;

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Basic security: RLS on, permissive for authenticated only
-- ============================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_read_authenticated" ON roles;
CREATE POLICY "roles_read_authenticated" ON roles FOR SELECT TO authenticated USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_all_authenticated" ON profiles;
CREATE POLICY "profiles_all_authenticated" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_all_authenticated" ON projects;
CREATE POLICY "projects_all_authenticated" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_members_all_authenticated" ON project_members;
CREATE POLICY "project_members_all_authenticated" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "versions_all_authenticated" ON versions;
CREATE POLICY "versions_all_authenticated" ON versions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_all_authenticated" ON tags;
CREATE POLICY "tags_all_authenticated" ON tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_all_authenticated" ON tasks;
CREATE POLICY "tasks_all_authenticated" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_tags_all_authenticated" ON task_tags;
CREATE POLICY "task_tags_all_authenticated" ON task_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_images_all_authenticated" ON task_images;
CREATE POLICY "task_images_all_authenticated" ON task_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_all_authenticated" ON comments;
CREATE POLICY "comments_all_authenticated" ON comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_all_authenticated" ON notifications;
CREATE POLICY "notifications_all_authenticated" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_all_authenticated" ON activity_logs;
CREATE POLICY "activity_logs_all_authenticated" ON activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'users cannot change their own role';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
      RAISE EXCEPTION 'only super admins can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_role_change ON profiles;
CREATE TRIGGER prevent_self_role_change BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_projects ON projects;
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_versions ON versions;
CREATE TRIGGER set_updated_at_versions BEFORE UPDATE ON versions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_tasks ON tasks;
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_comments ON comments;
CREATE TRIGGER set_updated_at_comments BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.slugify(text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(lower(trim($1)), '\s+', '-', 'g'), '[^a-z0-9\-]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.slug := public.slugify(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_slug_projects ON projects;
CREATE TRIGGER set_slug_projects BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.set_slug();
DROP TRIGGER IF EXISTS set_slug_versions ON versions;
CREATE TRIGGER set_slug_versions BEFORE INSERT OR UPDATE ON versions
  FOR EACH ROW EXECUTE FUNCTION public.set_slug();

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_version_id ON tasks(version_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_images_task_id ON task_images(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);

-- ============================================================
-- Realtime
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

-- ============================================================
-- Storage
-- ============================================================

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('task-screenshots', 'task-screenshots', true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('avatars', 'avatars', true, false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "screenshots_read" ON storage.objects;
CREATE POLICY "screenshots_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'task-screenshots');

DROP POLICY IF EXISTS "screenshots_insert" ON storage.objects;
CREATE POLICY "screenshots_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-screenshots');

DROP POLICY IF EXISTS "screenshots_delete" ON storage.objects;
CREATE POLICY "screenshots_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-screenshots');

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
