-- FIX_PROFILES_RLS_FOR_SIGNIN.sql
-- Fix profiles RLS to ensure sign-in still works
-- This ensures the original "Public profiles are viewable by everyone" policy exists

-- Ensure the public policy exists (create if missing, don't drop if exists)
-- This allows profile lookups during sign-in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Public profiles are viewable by everyone.'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone." ON profiles
      FOR SELECT USING (true);
  END IF;
END $$;

-- Ensure users can insert their own profile (for sign-up)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert their own profile.'
  ) THEN
    CREATE POLICY "Users can insert their own profile." ON profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Ensure users can update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own profile.'
  ) THEN
    CREATE POLICY "Users can update own profile." ON profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Add admin policy (in addition to public policy, not replacing it)
-- Note: We use a function to avoid recursive RLS issues
-- First, create a security definer function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION is_user_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = check_user_id), false);
$$;

-- Now create the admin policy using this function
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_user_admin(auth.uid()));

