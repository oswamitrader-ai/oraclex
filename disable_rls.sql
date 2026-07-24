-- Desabilitar RLS em todas as tabelas para permitir acesso via anon key
-- (Em produção, você deve criar políticas de acesso adequadas)

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE markets DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
