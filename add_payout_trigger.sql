-- ==========================================
-- SCRIPT DE PAGAMENTOS AUTOMÁTICOS (PAYOUTS)
-- ==========================================
-- Execute este script no SQL Editor do seu painel do Supabase.

-- 1. Cria a função que faz a matemática e distribui o dinheiro
CREATE OR REPLACE FUNCTION resolve_market_payouts()
RETURNS TRIGGER AS $$
DECLARE
    pos RECORD;
BEGIN
    -- Só roda a lógica SE o mercado acabou de ser fechado E tem um vencedor definido
    IF NEW.status = 'closed' AND OLD.status != 'closed' AND NEW.winner_side IS NOT NULL THEN
        
        -- Loop através de todas as posições (apostas) ATIVAS deste mercado
        FOR pos IN 
            SELECT * FROM positions 
            WHERE market_id = NEW.id AND status = 'active'
        LOOP
            -- Se o usuário apostou no lado vencedor, ele ganha!
            IF pos.side = NEW.winner_side THEN
                -- Adiciona o valor das cotas (shares) ao saldo da carteira do usuário.
                -- (Na plataforma, 1 cota = R$ 1,00 em caso de vitória).
                UPDATE users 
                SET balance = balance + pos.shares 
                WHERE id = pos.user_id;
            END IF;

            -- Marca a aposta (posição) como 'closed' para garantir que nunca seja paga duas vezes.
            UPDATE positions 
            SET status = 'closed' 
            WHERE id = pos.id;
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Remove a trigger se ela já existir (para evitar erros se você rodar o script mais de uma vez)
DROP TRIGGER IF EXISTS trigger_resolve_market_payouts ON markets;

-- 3. Cria o "Gatilho" para observar a tabela de mercados
CREATE TRIGGER trigger_resolve_market_payouts
AFTER UPDATE ON markets
FOR EACH ROW
EXECUTE FUNCTION resolve_market_payouts();
