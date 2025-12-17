-- FIX_TICKET_NUMBER_RACE_CONDITION_V3.sql
-- Final fix: Use proper transaction-level locking with INSERT ... ON CONFLICT
-- Only updates the functions, doesn't create tables or policies

-- Function to get or create sequence for today (FIXED VERSION)
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

-- Updated generate_ticket_number function (simplified, no retry needed)
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

