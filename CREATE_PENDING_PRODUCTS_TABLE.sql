-- Create pending_products table for AI-discovered products awaiting admin approval
CREATE TABLE IF NOT EXISTS pending_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10,2),
  description TEXT,
  category TEXT CHECK (category IN ('men', 'women', 'kids')),
  subcategory TEXT,
  trend_score DECIMAL(3,2) CHECK (trend_score >= 0 AND trend_score <= 1),
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  source TEXT CHECK (source IN ('ajio', 'myntra')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_link')),
  earnkaro_link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  ai_suggested_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pending_products_status ON pending_products(status);
CREATE INDEX IF NOT EXISTS idx_pending_products_category ON pending_products(category);
CREATE INDEX IF NOT EXISTS idx_pending_products_created ON pending_products(created_at DESC);

-- Enable RLS
ALTER TABLE pending_products ENABLE ROW LEVEL SECURITY;

-- Ensure is_user_admin function exists (safe to run multiple times)
-- This function bypasses RLS to check admin status, preventing recursive RLS issues
CREATE OR REPLACE FUNCTION is_user_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = check_user_id), false);
$$;

-- Safely create policies only if they don't exist (no destructive operations)
DO $$
BEGIN
  -- Create SELECT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pending_products' 
    AND policyname = 'Admins can view all pending products'
  ) THEN
    CREATE POLICY "Admins can view all pending products" ON pending_products
      FOR SELECT USING (is_user_admin(auth.uid()));
  END IF;

  -- Create UPDATE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pending_products' 
    AND policyname = 'Admins can update pending products'
  ) THEN
    CREATE POLICY "Admins can update pending products" ON pending_products
      FOR UPDATE USING (is_user_admin(auth.uid()));
  END IF;

  -- Create INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pending_products' 
    AND policyname = 'Admins can insert pending products'
  ) THEN
    CREATE POLICY "Admins can insert pending products" ON pending_products
      FOR INSERT WITH CHECK (is_user_admin(auth.uid()));
  END IF;
END $$;

