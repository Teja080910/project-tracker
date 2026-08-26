-- Human-friendly sequential numbers:
-- 1) tasks.number becomes a globally unique sequence (URLs /app/tasks/1,2,3...)
-- 2) project_apks get a per-project number (1,2,3...)

-- Tasks: backfill global numbering by creation order
CREATE SEQUENCE IF NOT EXISTS tasks_number_seq OWNED BY tasks.number;
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM tasks
)
UPDATE tasks t SET number = o.rn FROM ordered o WHERE t.id = o.id;
SELECT setval('tasks_number_seq', COALESCE((SELECT MAX(number) FROM tasks), 1));
ALTER TABLE tasks ALTER COLUMN number SET DEFAULT nextval('tasks_number_seq');

-- APKs: add number column and backfill per project
ALTER TABLE public.project_apks ADD COLUMN IF NOT EXISTS number int;
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM public.project_apks
)
UPDATE public.project_apks a SET number = o.rn FROM ordered o WHERE a.id = o.id;
ALTER TABLE public.project_apks ALTER COLUMN number SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_apk_number() RETURNS trigger AS $$
BEGIN
  IF NEW.number IS NULL THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM public.project_apks WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apk_number_trigger ON public.project_apks;
CREATE TRIGGER apk_number_trigger BEFORE INSERT ON public.project_apks
FOR EACH ROW EXECUTE FUNCTION public.set_apk_number();
