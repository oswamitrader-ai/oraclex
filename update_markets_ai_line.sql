-- Adiciona o campo JSON para configuração detalhada da linha da Inteligência Artificial
ALTER TABLE public.markets 
ADD COLUMN ai_line_config JSONB DEFAULT '{"x1": 0, "y1": 0.6, "x2": 1, "y2": 0.6}'::jsonb;
