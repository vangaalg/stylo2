-- FIX FOR RLS POLICY VIOLATION
-- Run this entire script in your Supabase SQL Editor

-- 1. Drop the existing restrictive policy (if it exists)
drop policy if exists "User can insert their own history." on generated_history;

-- 2. Create the correct INSERT policy
-- This explicitly allows inserting a row where the user_id column matches the authenticated user's ID
create policy "User can insert their own history."
on generated_history
for insert
with check (auth.uid() = user_id);

-- 3. Create SELECT policy (so you can see what you inserted)
drop policy if exists "User can view their own history." on generated_history;
create policy "User can view their own history."
on generated_history
for select
using (auth.uid() = user_id);

-- 4. Grant necessary permissions (just in case)
grant all on generated_history to authenticated;
grant all on generated_history to service_role;

