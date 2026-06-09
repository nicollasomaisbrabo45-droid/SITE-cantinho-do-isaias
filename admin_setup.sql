-- ==============================================================================
-- 🚀 SCRIPT SEPARADO: CONFIGURAÇÃO DE ADMIN AVANÇADA (TABELA EXCLUSIVA)
-- Copie e cole este código no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- 1. Adiciona a coluna de cargos (roles) na tabela profiles, caso não exista
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cliente';

-- 2. Cria a função de segurança para o banco de dados saber quem é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cria a tabela exclusiva para listar os emails dos administradores
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilita RLS na tabela admins (Apenas admins podem ver ou modificar a lista)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins podem ver a lista de admins" ON public.admins;
DROP POLICY IF EXISTS "Admins podem adicionar novos admins" ON public.admins;
DROP POLICY IF EXISTS "Admins podem remover admins" ON public.admins;

CREATE POLICY "Admins podem ver a lista de admins" ON public.admins FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins podem adicionar novos admins" ON public.admins FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins podem remover admins" ON public.admins FOR DELETE USING (public.is_admin());

-- 4. Adiciona o primeiro administrador oficial na lista de acesso
INSERT INTO public.admins (email) 
VALUES ('nicollasomaisbrabo45@gmail.com') 
ON CONFLICT (email) DO NOTHING;

-- 5. Atualiza o Gatilho (Trigger) para ler a nova tabela de admins ao criar contas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- Checa se o email da pessoa está na lista exclusiva de admins
  IF EXISTS (SELECT 1 FROM public.admins WHERE email = NEW.email) THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'cliente';
  END IF;

  INSERT INTO public.profiles (id, email, nome, id_reconhecimento, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'reconhecimento_id', public.generate_reconhecimento_id(NEW.email)),
    assigned_role
  );
  RETURN NEW;
END;
$$;

-- 6. Atualiza a sua conta para Admin retroativamente (caso já exista em profiles)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'nicollasomaisbrabo45@gmail.com';
