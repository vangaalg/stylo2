-- FIX_PROFILES_RLS_FOR_SIGNIN.sql
-- Fix profiles RLS to ensure sign-in still works
-- This ensures the original "Public profiles are viewable by everyone" policy exists

-- Ensure the public policy exists (don't drop it, just create if missing)
-- This allows profile lookups during sign-in
CREATE POLICY IF NOT EXISTS "Public profiles are viewable by everyone." ON profiles
  FOR SELECT USING (true);

-- Ensure users can insert their own profile (for sign-up)
CREATE POLICY IF NOT EXISTS "Users can insert their own profile." ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure users can update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile." ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Add admin policy (in addition to public policy, not replacing it)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_admin = true
    )
  );

