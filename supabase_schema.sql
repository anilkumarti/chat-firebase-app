-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Users/profiles table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  blocked TEXT[] DEFAULT '{}'::TEXT[]
);

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

-- ── Storage ─────────────────────────────────────────────────────────────────
-- In Dashboard → Storage → New bucket:
--   Name: chat-images
--   Public bucket: ✓ (so image URLs are accessible without auth)
--
-- Then add this storage policy (Dashboard → Storage → Policies):
--   Bucket: chat-images
--   Operation: INSERT
--   Policy: (auth.role() = 'authenticated')
