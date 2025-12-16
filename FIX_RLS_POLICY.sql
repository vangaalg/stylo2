-- Diagnostic and Fix Script for generated_history RLS Policy
-- Run this in your Supabase SQL Editor if the RLS policy is not working

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'generated_history';

-- 2. Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'generated_history';

-- 3. Drop existing INSERT policy if it exists (to recreate it)
DROP POLICY IF EXISTS "User can insert their own history." ON generated_history;

-- 4. Recreate the INSERT policy with explicit check
CREATE POLICY "User can insert their own history." ON generated_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Verify the policy was created
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'generated_history' AND cmd = 'INSERT';

-- 6. Test query (this will show what auth.uid() returns for your current session)
-- Note: This will only work if you're authenticated
SELECT auth.uid() as current_user_id;

