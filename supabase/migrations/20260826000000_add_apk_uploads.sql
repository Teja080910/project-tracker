-- Personal access tokens (for APK uploads via API)
CREATE TABLE IF NOT EXISTS public.personal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'token',
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Project APK builds (max 10 per project, oldest auto-deleted)
CREATE TABLE IF NOT EXISTS public.project_apks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id),
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_apks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pats_all_authenticated" ON public.personal_access_tokens;
CREATE POLICY "pats_all_authenticated" ON public.personal_access_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "apks_read_authenticated" ON public.project_apks;
CREATE POLICY "apks_read_authenticated" ON public.project_apks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "apks_insert_authenticated" ON public.project_apks;
CREATE POLICY "apks_insert_authenticated" ON public.project_apks
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "apks_delete_authenticated" ON public.project_apks;
CREATE POLICY "apks_delete_authenticated" ON public.project_apks
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pats_user ON public.personal_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_apks_project ON public.project_apks(project_id, created_at DESC);

-- Public storage bucket so testers can download/install directly
INSERT INTO storage.buckets (id, name, public)
VALUES ('apks', 'apks', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "apks_bucket_read" ON storage.objects;
CREATE POLICY "apks_bucket_read" ON storage.objects
  FOR SELECT TO authenticated, anon USING (bucket_id = 'apks');

DROP POLICY IF EXISTS "apks_bucket_write" ON storage.objects;
CREATE POLICY "apks_bucket_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'apks');

DROP POLICY IF EXISTS "apks_bucket_delete" ON storage.objects;
CREATE POLICY "apks_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'apks');
