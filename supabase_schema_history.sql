-- SQL for price history tracking
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair TEXT UNIQUE NOT NULL, -- e.g., 'USD/VES', 'USD/COP', 'USD/BRL'
  last_price NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial values for Venezuela and Colombia
INSERT INTO public.price_history (pair, last_price) 
VALUES 
  ('USD/VES', 0), 
  ('USD/COP', 0)
ON CONFLICT (pair) DO NOTHING;

-- Enable RLS (Only service_role/admin should write here)
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read (to see last update)
CREATE POLICY "Anyone can read price history" 
ON public.price_history FOR SELECT 
USING (true);
