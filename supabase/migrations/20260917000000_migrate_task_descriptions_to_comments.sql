-- Task descriptions are no longer used: the description entered when creating a
-- task is now stored as the task's first comment. Move any existing descriptions
-- into comments so no information is lost, then clear the column.

INSERT INTO comments (task_id, user_id, message, created_at)
SELECT t.id, t.reporter_id, btrim(t.description), t.created_at
FROM tasks t
WHERE t.description IS NOT NULL
  AND btrim(t.description) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id
      AND c.user_id = t.reporter_id
      AND c.message = btrim(t.description)
  );

UPDATE tasks SET description = NULL WHERE description IS NOT NULL;
