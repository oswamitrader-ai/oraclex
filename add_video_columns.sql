-- Execute este script no SQL Editor do seu Supabase
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_type TEXT,
ADD COLUMN IF NOT EXISTS ai_counter_type TEXT,
ADD COLUMN IF NOT EXISTS ai_current_count INTEGER DEFAULT 0;
