-- ============================================================
-- Admin role (global) — can create projects; project-level powers
-- come from project_members role in each project
-- ============================================================
INSERT INTO roles (id, name, description) VALUES
  ('admin', 'Admin', 'Can create projects; manages projects they own or are project_admin in')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Task soft delete
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks (deleted_at) WHERE deleted_at IS NOT NULL;
