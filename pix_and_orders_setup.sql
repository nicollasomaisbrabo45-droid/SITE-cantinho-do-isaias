-- ==============================================================================
-- 🚀 SCRIPT DE CONFIGURAÇÃO DE PIX E ATUALIZAÇÕES DE PEDIDO
-- Copie este código, cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- 1. ATUALIZAÇÕES NA TABELA DE PEDIDOS (orders)
-- Adiciona colunas para status_pagamento se não existir
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente';

-- Atualiza a coluna status se precisar de mais granularidade (opcional, mantendo compatibilidade)
-- status possíveis: 'recebido', 'preparando', 'saiu_para_entrega', 'entregue', 'cancelado'
-- Atualmente na database.sql o default era 'pendente'. Vamos assumir 'recebido' ou 'pendente'.

-- 2. TABELA DE PAGAMENTOS PIX
CREATE TABLE IF NOT EXISTS public.pagamentos_pix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  qrcode_base64 TEXT,
  copia_e_cola TEXT,
  status TEXT DEFAULT 'pendente', -- pendente, pago, expirado, cancelado
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pago_em TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS na tabela pagamentos_pix
ALTER TABLE public.pagamentos_pix ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para pagamentos_pix
DROP POLICY IF EXISTS "Usuários veem pagamentos dos seus pedidos" ON public.pagamentos_pix;
DROP POLICY IF EXISTS "Usuários logados podem criar pagamentos pix" ON public.pagamentos_pix;
DROP POLICY IF EXISTS "Sistema/Webhook pode atualizar pagamentos" ON public.pagamentos_pix;

-- Permite ver o pagamento se o pedido for do próprio usuário (ou se for anônimo e tiver o id, para simplificar vamos deixar público para leitura com base no ID)
CREATE POLICY "Leitura de pagamentos pix pública" ON public.pagamentos_pix FOR SELECT USING (true);
CREATE POLICY "Inserção livre de pagamentos pix" ON public.pagamentos_pix FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização livre de pagamentos pix" ON public.pagamentos_pix FOR UPDATE USING (true); -- Permitindo update pelo frontend simulado. (Em prod, seria restrito a is_admin() ou Edge Function auth).

-- Adicionamos Realtime na tabela orders e pagamentos_pix para atualizações na UI
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE pagamentos_pix;
