-- Allow inserting notifications for any user (needed for task assignment/status change notifications)
-- The old policy WITH CHECK (user_id = auth.uid()) blocked sending notifications to other users

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
