-- Extend task statuses: testing, test_release, released
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('open','in_progress','testing','test_release','released','completed','cancelled'));
