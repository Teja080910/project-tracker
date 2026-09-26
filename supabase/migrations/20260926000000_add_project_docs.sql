-- ============================================================
-- Project documentation (Confluence-style pages, nested)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES project_docs(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_docs_project_id ON project_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_docs_parent_id ON project_docs(parent_id);

ALTER TABLE project_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_docs_all_not_disabled" ON project_docs;
CREATE POLICY "project_docs_all_not_disabled" ON project_docs
  FOR ALL TO authenticated
  USING (NOT public.is_user_disabled())
  WITH CHECK (NOT public.is_user_disabled());

DROP TRIGGER IF EXISTS set_updated_at_project_docs ON project_docs;
CREATE TRIGGER set_updated_at_project_docs BEFORE UPDATE ON project_docs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Storage bucket for images embedded in docs
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('docs', 'docs', true, false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "docs_read" ON storage.objects;
CREATE POLICY "docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'docs' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "docs_insert" ON storage.objects;
CREATE POLICY "docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'docs' AND NOT public.is_user_disabled());

DROP POLICY IF EXISTS "docs_delete" ON storage.objects;
CREATE POLICY "docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'docs' AND NOT public.is_user_disabled());
