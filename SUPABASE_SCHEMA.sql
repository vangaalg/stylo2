-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  credits integer default 10,
  is_admin boolean default false,
  last_session_id text, -- Added for single session enforcement
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for generated image history
create table generated_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  image_url text not null,
  style text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS) for history
alter table generated_history enable row level security;

create policy "User can view their own history." on generated_history
  for select using (auth.uid() = user_id);

create policy "User can insert their own history." on generated_history
  for insert with check (auth.uid() = user_id);

create policy "User can delete their own history." on generated_history
  for delete using (auth.uid() = user_id);
