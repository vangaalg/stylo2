-- Create product_catalog table for approved live products
CREATE TABLE IF NOT EXISTS product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('men', 'women', 'kids')),
  subcategory TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  original_product_url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ajio', 'myntra')),
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category, is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalog_source ON product_catalog(source);
CREATE INDEX IF NOT EXISTS idx_product_catalog_active ON product_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalog_created ON product_catalog(created_at DESC);

-- Enable RLS
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- Safely create policies only if they don't exist (no destructive operations)
DO $$
BEGIN
  -- Create public SELECT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'product_catalog' 
    AND policyname = 'Anyone can view active products'
  ) THEN
    CREATE POLICY "Anyone can view active products" ON product_catalog
      FOR SELECT USING (is_active = true);
  END IF;

  -- Create admin management policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'product_catalog' 
    AND policyname = 'Admins can manage all products'
  ) THEN
    CREATE POLICY "Admins can manage all products" ON product_catalog
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Safely create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_product_catalog_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_product_catalog_updated_at
      BEFORE UPDATE ON product_catalog
      FOR EACH ROW
      EXECUTE FUNCTION update_product_catalog_updated_at();
  END IF;
END $$;

