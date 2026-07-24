-- Execute este script no SQL Editor do seu Supabase
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS ai_target_count INTEGER DEFAULT 0;
