-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabelas Base
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  wallet_address TEXT,
  role TEXT DEFAULT 'user',
  balance DECIMAL(10,2) DEFAULT 1000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  start_chance DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  current_yes DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  volume DECIMAL(15,2) DEFAULT 0.00,
  status TEXT DEFAULT 'active', -- active, closed
  winner_side TEXT, -- yes, no (quando encerrado)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- deposit, withdraw
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  market_id UUID REFERENCES markets(id),
  side TEXT NOT NULL, -- yes, no
  amount DECIMAL(10,2) NOT NULL,
  shares DECIMAL(15,2) NOT NULL,
  price DECIMAL(5,2) NOT NULL,
  status TEXT DEFAULT 'active', -- active, closed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir o primeiro Admin (mock auth) e algumas categorias iniciais
INSERT INTO users (name, wallet_address, role, balance) 
VALUES ('Administrador', '0xADMIN000000', 'admin', 999999.00);

INSERT INTO categories (name, icon) VALUES 
('Tendências', '🔥'),
('Política', '🗳️'),
('Cripto', '₿'),
('Esportes', '⚽'),
('Cultura', '🎬'),
('Economia', '🏦');
