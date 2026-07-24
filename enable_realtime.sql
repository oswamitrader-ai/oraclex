-- Ativar o Realtime para as tabelas principais no Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
