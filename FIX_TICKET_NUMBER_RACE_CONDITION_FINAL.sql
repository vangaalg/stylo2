-- FIX_TICKET_NUMBER_RACE_CONDITION_FINAL.sql
-- Complete fix that creates table if needed and updates functions
-- This ensures the sequence table exists before using it

-- Step 1: Create the sequence table if it doesn't exist
CREATE TABLE IF NOT EXISTS ticket_number_sequences (
  date_key text PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS ticket_number_sequences_date_key_idx ON ticket_number_sequences(date_key);

-- Step 3: Function to get or create sequence for today (FIXED VERSION)
CREATE OR REPLACE FUNCTION get_or_create_ticket_sequence(p_date_key text)
RETURNS integer AS $$
DECLARE
  v_last_number integer;
BEGIN
  -- Use INSERT ... ON CONFLICT with proper locking
  -- This ensures atomicity even under high concurrency
  INSERT INTO ticket_number_sequences (date_key, last_number)
  VALUES (p_date_key, 1)
  ON CONFLICT (date_key) 
  DO UPDATE SET 
    last_number = ticket_number_sequences.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_last_number;
  
  RETURN v_last_number;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Updated generate_ticket_number function (simplified, no retry needed)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  date_part text;
  seq_num integer;
  ticket_num text;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get next sequence number atomically using INSERT ... ON CONFLICT
  -- This is thread-safe and handles concurrent requests properly
  seq_num := get_or_create_ticket_sequence('TKT-' || date_part);
  ticket_num := 'TKT-' || date_part || '-' || LPAD(seq_num::text, 3, '0');
  
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

