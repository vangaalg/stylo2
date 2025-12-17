-- FIX_TICKET_NUMBER_RACE_CONDITION_V2.sql
-- More robust fix using sequence-based approach with retry logic
-- This handles race conditions even under high concurrency

-- First, create a sequence table to track daily ticket counters
CREATE TABLE IF NOT EXISTS ticket_number_sequences (
  date_key text PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS ticket_number_sequences_date_key_idx ON ticket_number_sequences(date_key);

-- Function to get or create sequence for today
CREATE OR REPLACE FUNCTION get_or_create_ticket_sequence(p_date_key text)
RETURNS integer AS $$
DECLARE
  v_last_number integer;
BEGIN
  -- Try to get existing sequence
  SELECT last_number INTO v_last_number
  FROM ticket_number_sequences
  WHERE date_key = p_date_key
  FOR UPDATE; -- Row-level lock
  
  IF v_last_number IS NULL THEN
    -- Create new sequence for today
    INSERT INTO ticket_number_sequences (date_key, last_number)
    VALUES (p_date_key, 0)
    ON CONFLICT (date_key) DO UPDATE SET last_number = ticket_number_sequences.last_number
    RETURNING last_number INTO v_last_number;
  END IF;
  
  -- Increment and update
  v_last_number := v_last_number + 1;
  UPDATE ticket_number_sequences
  SET last_number = v_last_number, updated_at = NOW()
  WHERE date_key = p_date_key;
  
  RETURN v_last_number;
END;
$$ LANGUAGE plpgsql;

-- Updated generate_ticket_number function with retry logic
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  date_part text;
  seq_num integer;
  ticket_num text;
  max_retries integer := 10;
  retry_count integer := 0;
  success boolean := false;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Use sequence-based approach with retry
  WHILE NOT success AND retry_count < max_retries LOOP
    BEGIN
      -- Get next sequence number atomically
      seq_num := get_or_create_ticket_sequence('TKT-' || date_part);
      ticket_num := 'TKT-' || date_part || '-' || LPAD(seq_num::text, 3, '0');
      
      -- Verify the ticket number doesn't already exist (double-check)
      -- This handles edge cases where sequence was incremented but insert failed
      IF NOT EXISTS (
        SELECT 1 FROM support_tickets 
        WHERE ticket_number = ticket_num
      ) THEN
        success := true;
      ELSE
        -- Ticket number exists, retry with next number
        retry_count := retry_count + 1;
        PERFORM pg_sleep(0.01 * retry_count); -- Small delay before retry
      END IF;
    EXCEPTION WHEN OTHERS THEN
      retry_count := retry_count + 1;
      PERFORM pg_sleep(0.01 * retry_count);
    END;
  END LOOP;
  
  IF NOT success THEN
    RAISE EXCEPTION 'Failed to generate unique ticket number after % retries', max_retries;
  END IF;
  
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

