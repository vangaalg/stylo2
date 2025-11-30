-- Add rating column to generated_history table
ALTER TABLE generated_history 
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Create a function to get the count of 5-star ratings globally
CREATE OR REPLACE FUNCTION get_five_star_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM generated_history WHERE rating = 5);
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_five_star_count TO anon, authenticated, service_role;

