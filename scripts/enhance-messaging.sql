-- Enhanced Messaging Tables with Typing Indicators and Read Receipts
-- This script updates the existing messaging tables to support premium features

-- Add typing indicator tracking to conversation_participants
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS typing_updated_at TIMESTAMPTZ;

-- Add read receipt tracking to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for typing indicators
CREATE INDEX IF NOT EXISTS idx_conv_participants_typing ON conversation_participants(conversation_id, is_typing) WHERE is_typing = TRUE;

-- Create index for unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(conversation_id, read_at);

-- Function to automatically update typing timestamp
CREATE OR REPLACE FUNCTION update_typing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_typing = TRUE THEN
    NEW.typing_updated_at = NOW();
  ELSE
    NEW.typing_updated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for typing timestamp
DROP TRIGGER IF EXISTS typing_timestamp_trigger ON conversation_participants;
CREATE TRIGGER typing_timestamp_trigger
  BEFORE UPDATE ON conversation_participants
  FOR EACH ROW
  WHEN (OLD.is_typing IS DISTINCT FROM NEW.is_typing)
  EXECUTE FUNCTION update_typing_timestamp();

-- Enable realtime for typing indicators (skip if already added)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'conversation_participants table is already enabled for realtime';
  END;
END $$;

-- Policy for updating typing status
DROP POLICY IF EXISTS "part_typing_update" ON conversation_participants;
CREATE POLICY "part_typing_update" ON conversation_participants 
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
