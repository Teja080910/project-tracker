-- Allow super_admin to update any profile
DROP POLICY IF EXISTS "profiles_update_super_admin" ON profiles;
CREATE POLICY "profiles_update_super_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );
