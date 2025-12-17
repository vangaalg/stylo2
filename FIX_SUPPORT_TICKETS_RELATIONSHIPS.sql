-- FIX_SUPPORT_TICKETS_RELATIONSHIPS.sql
-- Fix relationships for support_tickets table and link to generated_history

-- Step 1: Add foreign key constraint to profiles
-- Note: This assumes profiles.id references auth.users.id (which it should)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'support_tickets_user_id_profiles_fkey'
  ) THEN
    -- Add foreign key to profiles
    ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key constraint support_tickets_user_id_profiles_fkey';
  ELSE
    RAISE NOTICE 'Foreign key constraint support_tickets_user_id_profiles_fkey already exists';
  END IF;
END $$;

-- Step 2: Add column to link tickets to generated_history entries
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS related_history_ids uuid[];

-- Step 3: Add index for faster queries on history IDs
CREATE INDEX IF NOT EXISTS support_tickets_related_history_ids_idx 
ON support_tickets USING GIN (related_history_ids);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN support_tickets.related_history_ids IS 'Array of generated_history IDs linked to this ticket';

-- Step 5: Ensure the table exists (idempotent)
-- This is already handled by CREATE_SUPPORT_TICKETS_TABLE.sql, but included for safety

