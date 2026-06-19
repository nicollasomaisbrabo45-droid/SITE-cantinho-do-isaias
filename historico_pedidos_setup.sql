-- ==============================================================================
-- 📋 SCRIPT DE HISTÓRICO DE PEDIDOS POR USUÁRIO
-- Execute no SQL Editor do Supabase
-- ==============================================================================

-- 1. Garante que a tabela orders tem a coluna user_id (já deve ter, mas por segurança)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Habilitar RLS na tabela orders (caso não esteja habilitado)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para a tabela orders
-- Remove políticas antigas para recriar limpas
DROP POLICY IF EXISTS "Usuários podem criar pedidos" ON public.orders;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios pedidos" ON public.orders;
DROP POLICY IF EXISTS "Admins podem ver todos os pedidos" ON public.orders;

-- Permite que usuários logados criem pedidos (vinculados ao seu user_id)
CREATE POLICY "Usuários podem criar pedidos"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Permite que cada usuário veja APENAS os seus próprios pedidos
CREATE POLICY "Usuários podem ver seus próprios pedidos"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Permite que admins vejam todos os pedidos
CREATE POLICY "Admins podem ver todos os pedidos"
  ON public.orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 4. Políticas RLS para order_items (para que o SELECT aninhado funcione)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver itens dos seus pedidos" ON public.order_items;

CREATE POLICY "Usuários podem ver itens dos seus pedidos"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários podem inserir itens de pedido" ON public.order_items;

CREATE POLICY "Usuários podem inserir itens de pedido"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- 5. Realtime já está habilitado para a tabela orders — nenhuma ação necessária.
-- (ALTER PUBLICATION supabase_realtime ADD TABLE public.orders já foi executado antes)
