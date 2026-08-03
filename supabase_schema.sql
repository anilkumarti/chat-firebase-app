-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Users/profiles table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  blocked TEXT[] DEFAULT '{}'::TEXT[],
  phone TEXT DEFAULT NULL,
  phone_contacts JSONB DEFAULT NULL
);

-- Run these if the table already exists:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_contacts JSONB DEFAULT NULL;

-- Chats table — TEXT primary key supports both UUIDs and the AI chat pattern
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  messages JSONB DEFAULT '[]'::JSONB
);

-- Per-user chat list with metadata (last message, seen status, etc.)
CREATE TABLE IF NOT EXISTS user_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chats JSONB DEFAULT '[]'::JSONB,
  UNIQUE(user_id)
);

-- Required for realtime row-level filtering on updates
ALTER TABLE chats REPLICA IDENTITY FULL;
ALTER TABLE user_chats REPLICA IDENTITY FULL;

-- Enable realtime on these tables (also do this in Dashboard → Database → Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE chats;
-- ALTER PUBLICATION supabase_realtime ADD TABLE user_chats;

-- ── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Anyone can read users" ON users FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- chats
CREATE POLICY "Authenticated can read chats" ON chats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert chats" ON chats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update chats" ON chats FOR UPDATE USING (auth.role() = 'authenticated');

-- user_chats
CREATE POLICY "Users read own user_chats" ON user_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own user_chats" ON user_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own user_chats" ON user_chats FOR UPDATE USING (auth.uid() = user_id);
-- Needed so user B can update user A's chat list when adding a contact
CREATE POLICY "Authenticated update any user_chats" ON user_chats FOR UPDATE USING (auth.role() = 'authenticated');

-- ── Groups (for group chat feature) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar TEXT DEFAULT NULL,
  created_by UUID REFERENCES users(id),
  member_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE groups REPLICA IDENTITY FULL;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their groups" ON groups
  FOR SELECT USING (auth.uid() = ANY(member_ids));
CREATE POLICY "Authenticated can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can update group" ON groups
  FOR UPDATE USING (auth.uid() = ANY(member_ids));

-- ── Full-Text Message Search ────────────────────────────────────────────────
-- Run in Supabase SQL Editor. Uses SECURITY DEFINER so it can read across
-- tables while still filtering to only the caller's chats via searcher_id.
CREATE OR REPLACE FUNCTION search_messages(query_text TEXT, searcher_id UUID)
RETURNS TABLE(
  chat_id   TEXT,
  chat_entry JSONB,
  message    JSONB
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    c.id                 AS chat_id,
    ce                   AS chat_entry,
    msg                  AS message
  FROM user_chats uc,
       jsonb_array_elements(uc.chats) ce,
       chats c,
       jsonb_array_elements(c.messages) msg
  WHERE uc.user_id = searcher_id
    AND (ce->>'chatId') = c.id
    AND length(trim(query_text)) > 0
    AND (msg->>'text') ILIKE '%' || trim(query_text) || '%'
  ORDER BY (msg->>'createdAt') DESC NULLS LAST
  LIMIT 50;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_messages(TEXT, UUID) TO authenticated;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- In Dashboard → Storage → New bucket:
--   Name: chat-images
--   Public bucket: ✓ (so image URLs are accessible without auth)
--
-- Then add this storage policy (Dashboard → Storage → Policies):
--   Bucket: chat-images
--   Operation: INSERT
--   Policy: (auth.role() = 'authenticated')
