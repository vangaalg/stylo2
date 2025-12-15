-- Create transactions table
create table transactions (
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
alter table transactions enable row level security;

-- Users can view their own transactions
create policy "Users can view their own transactions." on transactions
  for select using (auth.uid() = user_id);

-- Users can insert their own transactions
create policy "Users can insert their own transactions." on transactions
  for insert with check (auth.uid() = user_id);

-- Create index for faster queries
create index transactions_user_id_idx on transactions(user_id);
create index transactions_created_at_idx on transactions(created_at desc);

