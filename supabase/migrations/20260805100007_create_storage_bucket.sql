-- Create task-screenshots storage bucket (persists across db reset)
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('task-screenshots', 'task-screenshots', true, false)
ON CONFLICT (id) DO NOTHING;
