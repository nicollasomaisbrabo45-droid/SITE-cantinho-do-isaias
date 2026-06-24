-- ==============================================================================
-- 🚀 SCRIPT DE CONFIGURAÇÃO DE PERMISSÕES PARA ADMINS (SUPABASE)
-- Copie todo este código, cole no SQL Editor do Supabase e clique em RUN!
-- ==============================================================================

-- Remove a política caso já exista (para evitar erros de duplicidade)
DROP POLICY IF EXISTS "Admins podem atualizar todos os perfis" ON public.profiles;

-- Cria a política permitindo que quem tem a função is_admin() verdadeira 
-- atualize qualquer registro na tabela profiles
CREATE POLICY "Admins podem atualizar todos os perfis" ON public.profiles 
FOR UPDATE USING (public.is_admin());
