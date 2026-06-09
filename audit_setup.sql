-- ==============================================================================
-- 🚀 SCRIPT DE AUDITORIA COMPLETA — CARDÁPIO E CATEGORIAS
-- Salva automaticamente TUDO que for adicionado, editado ou removido.
-- Cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- ==============================================================================
-- 1. GARANTIR QUE A TABELA MENU TEM TODAS AS COLUNAS NECESSÁRIAS
-- ==============================================================================
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Políticas de acesso para admins gerenciarem o cardápio
DROP POLICY IF EXISTS "Admins podem inserir itens no menu"  ON public.menu;
DROP POLICY IF EXISTS "Admins podem editar itens do menu"   ON public.menu;
DROP POLICY IF EXISTS "Admins podem remover itens do menu"  ON public.menu;

CREATE POLICY "Admins podem inserir itens no menu" ON public.menu
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins podem editar itens do menu" ON public.menu
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins podem remover itens do menu" ON public.menu
  FOR DELETE USING (public.is_admin());

-- ==============================================================================
-- 2. TABELA DE AUDITORIA — Registra TODAS as mudanças (itens e categorias)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela      TEXT NOT NULL,              -- 'menu' ou 'categories'
  acao        TEXT NOT NULL,              -- 'INSERT', 'UPDATE' ou 'DELETE'
  item_id     TEXT,                       -- ID do item alterado
  item_nome   TEXT,                       -- Nome do item/categoria
  dados_antes JSONB,                      -- Estado ANTES da mudança (para UPDATE e DELETE)
  dados_apos  JSONB,                      -- Estado APÓS a mudança (para INSERT e UPDATE)
  feito_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feito_em    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: apenas admins podem ver o histórico
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Apenas admins veem o audit log" ON public.audit_log;
CREATE POLICY "Apenas admins veem o audit log" ON public.audit_log FOR SELECT USING (public.is_admin());

-- ==============================================================================
-- 3. FUNÇÃO DE AUDITORIA (usada pelos dois triggers)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  nome_campo TEXT;
BEGIN
  -- Descobre o nome do item dependendo da tabela
  IF TG_TABLE_NAME = 'menu' THEN
    nome_campo := COALESCE(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END,
      'desconhecido'
    );
  ELSE
    nome_campo := COALESCE(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.nome ELSE NEW.nome END,
      'desconhecido'
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (tabela, acao, item_id, item_nome, dados_apos)
    VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::TEXT, nome_campo, to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (tabela, acao, item_id, item_nome, dados_antes, dados_apos)
    VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::TEXT, nome_campo, to_jsonb(OLD), to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tabela, acao, item_id, item_nome, dados_antes)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::TEXT, nome_campo, to_jsonb(OLD));
  END IF;

  RETURN NULL;
END;
$$;

-- ==============================================================================
-- 4. TRIGGER NA TABELA MENU (itens do cardápio)
-- ==============================================================================
DROP TRIGGER IF EXISTS audit_menu ON public.menu;
CREATE TRIGGER audit_menu
  AFTER INSERT OR UPDATE OR DELETE ON public.menu
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- ==============================================================================
-- 5. TRIGGER NA TABELA CATEGORIES (categorias)
-- ==============================================================================
DROP TRIGGER IF EXISTS audit_categories ON public.categories;
CREATE TRIGGER audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- ==============================================================================
-- 6. FUNÇÃO PARA ATUALIZAR O updated_at DO MENU AUTOMATICAMENTE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_menu_updated_at ON public.menu;
CREATE TRIGGER set_menu_updated_at
  BEFORE UPDATE ON public.menu
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
