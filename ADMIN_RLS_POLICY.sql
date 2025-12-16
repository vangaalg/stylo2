-- Allow admins to update any user's credits
-- This policy allows users who are admins (is_admin = true) to update credits for any user

CREATE POLICY "Admins can update any user's credits" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Note: This policy allows admins to update any field in the profiles table
-- If you want to restrict it to only credits field, you can modify the policy
-- However, for simplicity and admin flexibility, this allows full updates

