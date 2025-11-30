-- Run this in your Supabase SQL Editor to create the profiles table

-- 1. Create profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  credits integer default 10,
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable RLS
alter table profiles enable row level security;

-- 3. Create policies
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 4. Create a trigger to automatically create a profile on signup (Optional, but recommended)
-- This handles the case where 'getOrCreateUserProfile' might be bypassed or fail initially
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 10);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

