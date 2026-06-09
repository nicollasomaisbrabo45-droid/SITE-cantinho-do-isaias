-- ==============================================================================
-- 🚀 TABELA DE CATEGORIAS DO CARDÁPIO
-- Cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- Cria a tabela de categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '🍽️',
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilita RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categorias são públicas" ON public.categories;
DROP POLICY IF EXISTS "Apenas admins criam categorias" ON public.categories;
DROP POLICY IF EXISTS "Apenas admins deletam categorias" ON public.categories;

-- Qualquer um pode ver as categorias (para o cardápio do site)
CREATE POLICY "Categorias são públicas" ON public.categories FOR SELECT USING (true);

-- Apenas admins podem criar, editar ou remover categorias
CREATE POLICY "Apenas admins criam categorias" ON public.categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Apenas admins editam categorias" ON public.categories FOR UPDATE USING (public.is_admin());
CREATE POLICY "Apenas admins deletam categorias" ON public.categories FOR DELETE USING (public.is_admin());

-- Insere as categorias padrão já existentes no site
INSERT INTO public.categories (nome, icone, slug) VALUES
  ('Lanches',     '🍔', 'lanches'),
  ('Porções',     '🍟', 'porcoes'),
  ('Bebidas',     '🥤', 'bebidas'),
  ('Combos',      '🎁', 'combos'),
  ('Sobremesas',  '🍦', 'sobremesas')
ON CONFLICT (slug) DO NOTHING;
