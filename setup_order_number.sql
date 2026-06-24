-- ==============================================================================
-- 🚀 SCRIPT PARA ADICIONAR ID ÚNICO AOS PEDIDOS (SUPABASE)
-- Copie todo este código, cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- Adiciona a coluna order_number auto-incremental na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number SERIAL;
