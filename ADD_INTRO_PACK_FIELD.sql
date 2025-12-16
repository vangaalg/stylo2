-- Add field to track if user has purchased intro pack (one-time ₹9 package)
alter table profiles 
add column if not exists has_purchased_intro_pack boolean default false;

-- Add comment for clarity
comment on column profiles.has_purchased_intro_pack is 'Tracks if user has purchased the one-time intro pack (₹9 for 2 credits)';
