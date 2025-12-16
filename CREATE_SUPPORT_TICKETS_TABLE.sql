-- CREATE_SUPPORT_TICKETS_TABLE.sql
-- Create support tickets table for user complaints and refund requests

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  ticket_number text UNIQUE NOT NULL, -- Auto-generated ticket number (e.g., TKT-20241215-001)
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected', 'refunded')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Related generation info
  related_image_urls text[], -- Array of image URLs from the lookbook
  credits_used integer DEFAULT 0, -- Credits used for the generation
  generation_date timestamp with time zone,
  
  -- Attachments (stored in Supabase Storage)
  attachment_urls text[], -- Array of attachment URLs
  
  -- Admin resolution
  admin_notes text,
  resolved_by uuid REFERENCES auth.users, -- Admin who resolved it
  resolved_at timestamp with time zone,
  credits_refunded integer DEFAULT 0, -- Credits refunded (if any)
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (only before resolution)
CREATE POLICY "Users can update own pending tickets" ON support_tickets
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets" ON support_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update all tickets
CREATE POLICY "Admins can update all tickets" ON support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_ticket_number_idx ON support_tickets(ticket_number);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  date_part text;
  seq_num integer;
  ticket_num text;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM support_tickets
  WHERE ticket_number LIKE 'TKT-' || date_part || '-%';
  
  ticket_num := 'TKT-' || date_part || '-' || LPAD(seq_num::text, 3, '0');
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number_trigger
  BEFORE INSERT OR UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

