-- ============================================================
-- Emoji reactions on task comments
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Everyone (not disabled) can read reactions
DROP POLICY IF EXISTS "comment_reactions_select_not_disabled" ON comment_reactions;
CREATE POLICY "comment_reactions_select_not_disabled" ON comment_reactions
  FOR SELECT TO authenticated
  USING (NOT public.is_user_disabled());

-- Users can only add reactions as themselves
DROP POLICY IF EXISTS "comment_reactions_insert_own_not_disabled" ON comment_reactions;
CREATE POLICY "comment_reactions_insert_own_not_disabled" ON comment_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_user_disabled());

-- Users can only remove their own reactions
DROP POLICY IF EXISTS "comment_reactions_delete_own_not_disabled" ON comment_reactions;
CREATE POLICY "comment_reactions_delete_own_not_disabled" ON comment_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.is_user_disabled());

-- Realtime so reactions appear live for everyone viewing the task
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comment_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;
  END IF;
END;
$$;
