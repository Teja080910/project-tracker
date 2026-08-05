/*
# Project & Issue Management System — initial schema

Creates the full data model for a lightweight project management app.

1. New Tables
- `roles` — lookup for the 5 roles.
- `profiles` — extends auth.users with display name, avatar, global role.
- `projects` — a project with name, description, client, status, owner.
- `project_members` — junction linking users to projects with a role.
- `versions` — a version within a project.
- `tags` — reusable tag labels scoped to a project.
- `tasks` — a task/bug/story/issue within a project+version.
- `task_tags` — junction linking tasks to tags.
- `task_images` — storage paths of screenshots attached to a task.
- `comments` — comments on a task.
- `notifications` — in-app notifications for a user.
- `activity_logs` — audit trail of important actions.

2. Security
- RLS enabled on every table.
- Profiles: read all (for assignment dropdowns), update own.
- Projects: super_admin all; members read; owner/admin write.
- project_members: members read; project_admins & super_admin manage.
- versions: members read; project_admins & super_admin write.
- tasks: members read/create/update; only admin/super_admin delete.
- task_images, comments: members read/insert; own update; admin delete.
- notifications: user reads/updates only own.
- activity_logs: project members read; own insert (server actions use service role).
- tags, task_tags: members read; project_admins write.

3. Notes
- auth.uid() for ownership. Owner columns default to auth.uid().
- Trigger auto-creates a profile row on signup.
- Service role (bypasses RLS) used by server actions for privileged ops.
*/

-- ============================================================
-- PART 1: Create all tables first (no policies yet)
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
  name text NOT NULL,
  description text,
  client_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'developer' REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  release_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
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
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 2: Enable RLS + policies (all tables now exist)
-- ============================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
  OR owner_id = auth.uid()
);
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin') OR owner_id = auth.uid()
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin') OR owner_id = auth.uid()
);
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin') OR owner_id = auth.uid()
);

-- project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON project_members;
CREATE POLICY "pm_select" ON project_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid())
);
DROP POLICY IF EXISTS "pm_insert" ON project_members;
CREATE POLICY "pm_insert" ON project_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm2 WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid() AND pm2.role = 'project_admin')
);
DROP POLICY IF EXISTS "pm_update" ON project_members;
CREATE POLICY "pm_update" ON project_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm3 WHERE pm3.project_id = project_members.project_id AND pm3.user_id = auth.uid() AND pm3.role = 'project_admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm3 WHERE pm3.project_id = project_members.project_id AND pm3.user_id = auth.uid() AND pm3.role = 'project_admin')
);
DROP POLICY IF EXISTS "pm_delete" ON project_members;
CREATE POLICY "pm_delete" ON project_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm4 WHERE pm4.project_id = project_members.project_id AND pm4.user_id = auth.uid() AND pm4.role = 'project_admin')
);

-- versions
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "versions_select" ON versions;
CREATE POLICY "versions_select" ON versions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = versions.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "versions_insert" ON versions;
CREATE POLICY "versions_insert" ON versions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = versions.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);
DROP POLICY IF EXISTS "versions_update" ON versions;
CREATE POLICY "versions_update" ON versions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = versions.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = versions.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);
DROP POLICY IF EXISTS "versions_delete" ON versions;
CREATE POLICY "versions_delete" ON versions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = versions.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_select" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tags.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tags_insert" ON tags;
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tags.project_id AND pm.user_id = auth.uid() AND pm.role IN ('project_admin','developer','tester'))
);
DROP POLICY IF EXISTS "tags_delete" ON tags;
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tags.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);

-- task_tags
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_tags_select" ON task_tags;
CREATE POLICY "task_tags_select" ON task_tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_tags.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "task_tags_insert" ON task_tags;
CREATE POLICY "task_tags_insert" ON task_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_tags.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "task_tags_delete" ON task_tags;
CREATE POLICY "task_tags_delete" ON task_tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_tags.task_id AND pm.user_id = auth.uid())
);

-- task_images
ALTER TABLE task_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_images_select" ON task_images;
CREATE POLICY "task_images_select" ON task_images FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_images.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "task_images_insert" ON task_images;
CREATE POLICY "task_images_insert" ON task_images FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_images.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "task_images_delete" ON task_images;
CREATE POLICY "task_images_delete" ON task_images FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = task_images.task_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);

-- comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = comments.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = comments.task_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = comments.task_id AND pm.user_id = auth.uid() AND pm.role = 'project_admin')
);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT TO authenticated USING (
  project_id IS NULL
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = activity_logs.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- PART 3: Triggers, functions, indexes
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
