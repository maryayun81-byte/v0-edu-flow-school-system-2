# Database Migration Guide

This guide will help you set up all the required database tables and enhancements for Peak Performance Tutoring.

## Prerequisites

- Access to your Supabase dashboard
- SQL Editor access in Supabase

## Migration Steps

### Step 1: Create Notifications Table

Run this script first to create the notifications table:

**File:** `scripts/create-notifications-table.sql`

**What it does:**
- Creates `notifications` table with all columns
- Sets up indexes for performance
- Configures Row Level Security (RLS)
- Adds triggers for automatic timestamps
- Enables real-time subscriptions

**How to run:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Copy and paste the entire content of `create-notifications-table.sql`
5. Click "Run"
6. Verify success message

---

### Step 2: Enhance Messaging Tables

Run this script to add typing indicators and read receipts to messaging:

**File:** `scripts/enhance-messaging.sql`

**What it does:**
- Adds `is_typing` column to `conversation_participants`
- Adds `typing_updated_at` column
- Adds `read_at` column to `messages`
- Adds `delivered_at` column to `messages`
- Creates indexes for performance
- Sets up triggers for automatic updates
- Enables real-time for typing indicators

**How to run:**
1. In Supabase SQL Editor
2. Click "New Query"
3. Copy and paste the entire content of `enhance-messaging.sql`
4. Click "Run"
5. Verify success message

---

## Verification

After running both scripts, verify the tables exist:

```sql
-- Check notifications table
SELECT * FROM notifications LIMIT 1;

-- Check conversation_participants has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversation_participants' 
AND column_name IN ('is_typing', 'typing_updated_at');

-- Check messages has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('read_at', 'delivered_at');
```

---

## Troubleshooting

### Error: "relation does not exist"

**Problem:** The table you're trying to modify doesn't exist yet.

**Solution:** 
- For notifications: Run `create-notifications-table.sql` first
- For messaging: Check if `conversations`, `conversation_participants`, and `messages` tables exist
- If messaging tables don't exist, you may need to run your original database setup scripts first

### Error: "column already exists"

**Problem:** You've already run the migration script.

**Solution:** This is safe to ignore. The scripts use `IF NOT EXISTS` clauses to prevent errors.

### Error: "permission denied"

**Problem:** Your database user doesn't have sufficient permissions.

**Solution:** 
- Make sure you're logged in as the database owner
- In Supabase, use the SQL Editor with your service role key

---

## Testing Notifications

After migration, test the notifications system:

```sql
-- Create a test notification (as admin/teacher)
INSERT INTO notifications (
  type, 
  title, 
  message, 
  priority, 
  broadcast
) VALUES (
  'announcement',
  'Test Notification',
  'This is a test notification to verify the system works',
  'high',
  true
);

-- View all notifications
SELECT * FROM notifications ORDER BY created_at DESC;

-- Mark a notification as read
UPDATE notifications 
SET read = true 
WHERE id = 'YOUR_NOTIFICATION_ID';

-- Verify read_at was set automatically
SELECT id, title, read, read_at FROM notifications;
```

---

## Testing Messaging

After migration, test the messaging enhancements:

```sql
-- Check typing indicator columns exist
SELECT * FROM conversation_participants LIMIT 1;

-- Check read receipt columns exist
SELECT * FROM messages LIMIT 1;
```

---

## Next Steps

After successful migration:

1. ✅ Test PWA installation
2. ✅ Test navigation links
3. ✅ Test messaging with typing indicators
4. ✅ Test notifications with filters
5. ✅ Test theme switching
6. ✅ Test on mobile devices

---

## Rollback (if needed)

If you need to rollback the changes:

```sql
-- Remove notifications table
DROP TABLE IF EXISTS notifications CASCADE;

-- Remove messaging enhancements
ALTER TABLE conversation_participants 
  DROP COLUMN IF EXISTS is_typing,
  DROP COLUMN IF EXISTS typing_updated_at;

ALTER TABLE messages 
  DROP COLUMN IF EXISTS read_at,
  DROP COLUMN IF EXISTS delivered_at;
```

**⚠️ Warning:** Only rollback if absolutely necessary. This will delete all notification data.
