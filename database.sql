-- ==============================================================================
-- 🚀 SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
-- Copie todo este código, cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIO (COM ID DE RECONHECIMENTO E CARGOS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  id_reconhecimento VARCHAR(8) UNIQUE NOT NULL,
  role TEXT DEFAULT 'cliente', -- "cliente" ou "admin"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Caso a tabela já exista de antes, adiciona a coluna de role
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cliente';

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver o próprio perfil e outros podem ver perfis públicos (opcional)
DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar próprio perfil" ON public.profiles;

CREATE POLICY "Permitir leitura de perfis para todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuários podem criar próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- 2. FUNÇÕES DE UTILIDADE E SEGURANÇA (ADMIN)
-- ==============================================================================

-- Função para verificar de forma segura se quem está acessando é um admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. FUNÇÃO E TRIGGER PARA GERAR O ID DE RECONHECIMENTO (#TDS1828)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.generate_reconhecimento_id(user_email TEXT)
RETURNS VARCHAR(8) AS $$
DECLARE
  prefix TEXT;
  letters TEXT := '';
  numbers TEXT;
  new_id VARCHAR(8);
  is_unique BOOLEAN := FALSE;
BEGIN
  prefix := REGEXP_REPLACE(SPLIT_PART(user_email, '@', 1), '[0-9]', '', 'g');
  prefix := UPPER(prefix);
  letters := SUBSTRING(prefix, 1, 3);
  WHILE LENGTH(letters) < 3 LOOP
    letters := letters || CHR(TRUNC(RANDOM() * 26)::INT + 65);
  END LOOP;
  WHILE NOT is_unique LOOP
    numbers := (TRUNC(RANDOM() * 8999) + 1000)::TEXT;
    new_id := '#' || letters || numbers;
    PERFORM 1 FROM public.profiles WHERE id_reconhecimento = new_id;
    IF NOT FOUND THEN
      is_unique := TRUE;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar o perfil automaticamente quando o usuário se registra no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, id_reconhecimento, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'reconhecimento_id', public.generate_reconhecimento_id(NEW.email)),
    -- Lógica para dar o cargo de admin automaticamente ao email principal
    CASE WHEN NEW.email = 'nicollasomaisbrabo45@gmail.com' THEN 'admin' ELSE 'cliente' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 3. OUTRAS TABELAS DO SISTEMA (PEDIDOS, ITENS, REVIEWS, MENU)
-- ==============================================================================

-- Tabela: menu (Cardápio)
CREATE TABLE IF NOT EXISTS public.menu (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image TEXT,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Menu é público para leitura" ON public.menu;
CREATE POLICY "Menu é público para leitura" ON public.menu FOR SELECT USING (true);


-- Tabela: reviews (Avaliações)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_delivery BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Adiciona a coluna caso a tabela já existisse antes sem ela
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Reviews são públicos" ON public.reviews;
DROP POLICY IF EXISTS "Usuários logados podem criar reviews" ON public.reviews;
CREATE POLICY "Reviews são públicos" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Usuários logados podem criar reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Tabela: orders (Pedidos)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_complement TEXT,
  payment_method TEXT,
  change_for NUMERIC(10,2),
  status TEXT DEFAULT 'pendente',
  is_delivery BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Adiciona a coluna caso a tabela já existisse antes sem ela
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Usuários veem seus próprios pedidos" ON public.orders;
DROP POLICY IF EXISTS "Usuários podem criar pedidos" ON public.orders;
-- Permite que o usuário veja apenas os SEUS PRÓPRIOS pedidos
CREATE POLICY "Usuários veem seus próprios pedidos" ON public.orders FOR SELECT USING (auth.uid() = user_id);
-- Permite que usuários LOGADOS criem pedidos
CREATE POLICY "Usuários podem criar pedidos" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Tabela: order_items (Itens do Pedido)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);
-- Adiciona a coluna caso a tabela já existisse antes sem ela
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Usuários veem os itens dos seus pedidos" ON public.order_items;
DROP POLICY IF EXISTS "Permitir inserir itens" ON public.order_items;
-- Permite ver os itens se o pedido for do próprio usuário
CREATE POLICY "Usuários veem os itens dos seus pedidos" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
-- Permite inserir itens no pedido
CREATE POLICY "Permitir inserir itens" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- ==============================================================================
-- 5. ATUALIZAÇÃO MANUAL PARA O PRIMEIRO ADMIN (Caso a conta já tenha sido criada)
-- ==============================================================================
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'nicollasomaisbrabo45@gmail.com';
