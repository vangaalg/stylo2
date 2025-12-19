-- CREATE_USER_FACE_PHOTOS_TABLE.sql
-- Store user face photos for reuse across multiple dress tries

CREATE TABLE IF NOT EXISTS user_face_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  image_url text NOT NULL, -- URL from Supabase Storage
  thumbnail_url text, -- Optional: smaller version for gallery
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  
  -- Keep only last 10 photos per user (enforced by application logic)
  CONSTRAINT unique_user_face_photo UNIQUE (user_id, image_url)
);

-- Enable RLS
ALTER TABLE user_face_photos ENABLE ROW LEVEL SECURITY;

-- Users can view their own face photos
CREATE POLICY "Users can view their own face photos" ON user_face_photos
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own face photos
CREATE POLICY "Users can insert their own face photos" ON user_face_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own face photos
CREATE POLICY "Users can delete their own face photos" ON user_face_photos
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS user_face_photos_user_id_idx ON user_face_photos(user_id, created_at DESC);

