-- Create transactions table (idempotent - safe to run multiple times)
-- Check if table exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
  ) THEN
    -- Create transactions table
    CREATE TABLE transactions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references auth.users not null,
      razorpay_payment_id text not null,
      razorpay_order_id text not null,
      amount integer not null, -- Amount in paise (e.g., 9900 for ₹99)
      currency text default 'INR',
      credits_added integer not null,
      package_name text,
      status text default 'completed', -- completed, failed, refunded
      created_at timestamp with time zone default timezone('utc'::text, now())
    );

    -- Set up Row Level Security (RLS)
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

    -- Users can view their own transactions
    CREATE POLICY "Users can view their own transactions." ON transactions
      FOR SELECT USING (auth.uid() = user_id);

    -- Users can insert their own transactions
    CREATE POLICY "Users can insert their own transactions." ON transactions
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Create index for faster queries
    CREATE INDEX transactions_user_id_idx ON transactions(user_id);
    CREATE INDEX transactions_created_at_idx ON transactions(created_at desc);
  END IF;
END $$;

-- Ensure RLS is enabled (safe to run even if already enabled)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own transactions." ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions." ON transactions;

CREATE POLICY "Users can view their own transactions." ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions." ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure indexes exist (safe to run - will skip if exists)
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at desc);
