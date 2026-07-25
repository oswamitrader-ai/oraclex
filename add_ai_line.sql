-- Adiciona a coluna ai_line_y na tabela markets, permitindo que o administrador ajuste a linha de contagem da IA
ALTER TABLE markets ADD COLUMN IF NOT EXISTS ai_line_y FLOAT DEFAULT 0.6;
