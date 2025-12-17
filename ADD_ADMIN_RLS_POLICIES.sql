-- ADD_ADMIN_RLS_POLICIES.sql
-- Add RLS policies to allow admins to view all user data
-- This enables the admin dashboard to show comprehensive user information

-- Admin can view all transactions
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admin can view all generated history
DROP POLICY IF EXISTS "Admins can view all history" ON generated_history;
CREATE POLICY "Admins can view all history" ON generated_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admin can view all profiles (add alongside existing public policy)
-- Note: We don't drop "Public profiles are viewable by everyone" - it should remain
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_admin = true
    )
  );

