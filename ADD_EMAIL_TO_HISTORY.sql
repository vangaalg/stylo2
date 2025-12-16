-- Add user_email column to generated_history table
ALTER TABLE generated_history
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add index for faster queries by email
CREATE INDEX IF NOT EXISTS generated_history_user_email_idx ON generated_history(user_email);

-- Update existing records to populate email from profiles table
UPDATE generated_history
SET user_email = (
  SELECT email 
  FROM profiles 
  WHERE profiles.id = generated_history.user_id
)
WHERE user_email IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN generated_history.user_email IS 'Email address of the user who generated the image';

