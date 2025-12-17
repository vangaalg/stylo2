-- CREATE_NOTIFICATIONS_TABLE.sql
-- Create notifications table for user notifications (credit refunds, ticket resolutions, etc.)

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL CHECK (type IN ('credit_refund', 'ticket_resolved', 'ticket_updated', 'credit_gifted', 'system_announcement')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  related_ticket_id uuid REFERENCES support_tickets(id), -- If notification is about a ticket
  related_transaction_id uuid, -- If notification is about a transaction
  metadata jsonb, -- Additional data (e.g., credits_refunded amount)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can create notifications (via service role or application logic)
-- Note: In production, you might want to restrict this to service role only
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Application will handle authorization

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_related_ticket_idx ON notifications(related_ticket_id);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'User notifications for credit refunds, ticket resolutions, and system announcements';

