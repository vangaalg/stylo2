-- FIX_TICKET_NUMBER_RACE_CONDITION.sql
-- Fix race condition in ticket number generation
-- Use advisory locks to prevent duplicates

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  date_part text;
  seq_num integer;
  ticket_num text;
  lock_id bigint;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Use advisory lock to prevent race conditions
  lock_id := hashtext('ticket_number_' || date_part);
  PERFORM pg_advisory_xact_lock(lock_id);
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM support_tickets
  WHERE ticket_number LIKE 'TKT-' || date_part || '-%';
  
  ticket_num := 'TKT-' || date_part || '-' || LPAD(seq_num::text, 3, '0');
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

