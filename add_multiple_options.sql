-- Adiciona colunas para suportar mercados de múltipla escolha
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS market_type TEXT DEFAULT 'binary',
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- A estrutura da coluna options será um array de objetos:
-- [
--   { "id": "uuid-ou-string", "title": "Opção A", "price": 25 },
--   { "id": "uuid-ou-string", "title": "Opção B", "price": 30 },
--   { "id": "uuid-ou-string", "title": "Opção C", "price": 45 }
-- ]
-- O price atualizado será mantido neste array e a soma sempre será 100%.
