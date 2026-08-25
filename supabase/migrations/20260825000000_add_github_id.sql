-- Add mandatory GitHub ID / email field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_id text;
