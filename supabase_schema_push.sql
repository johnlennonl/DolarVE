-- SQL for Supabase to support Web Push Notifications
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  platform TEXT, -- 'pwa', 'ios', 'android'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit their own subscriptions
CREATE POLICY "Users can manage their own subscriptions" 
ON push_subscriptions FOR ALL 
USING (auth.uid() = user_id);
