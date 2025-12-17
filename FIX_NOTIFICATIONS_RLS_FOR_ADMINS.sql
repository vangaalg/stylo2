-- FIX_NOTIFICATIONS_RLS_FOR_ADMINS.sql
-- Fix RLS policy to allow admins to create notifications for any user
-- This is needed when admins gift credits and need to notify the recipient

-- Drop the existing "System can create notifications" policy
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Drop the existing "Users can view their own notifications" policy (we'll recreate it with admin support)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

-- Create a new INSERT policy that allows:
-- 1. Users to create notifications for themselves (user_id = auth.uid())
-- 2. Admins to create notifications for any user
CREATE POLICY "Users and admins can create notifications" ON notifications
  FOR INSERT 
  WITH CHECK (
    -- Users can create notifications for themselves
    user_id = auth.uid() 
    OR 
    -- Admins can create notifications for any user
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Create a new SELECT policy that allows:
-- 1. Users to view their own notifications
-- 2. Admins to view all notifications (for support purposes)
CREATE POLICY "Users and admins can view notifications" ON notifications
  FOR SELECT 
  USING (
    -- Users can view their own notifications
    user_id = auth.uid()
    OR
    -- Admins can view all notifications (for support purposes)
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

