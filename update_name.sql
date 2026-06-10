-- 🚀 SCRIPT DE ATUALIZAÇÃO: NOME NO CADASTRO
-- Copie e rode este código no SQL Editor do Supabase se necessário.

-- 1. Garante que a coluna 'nome' existe na tabela de perfis
-- (No seu banco atual ela já deve existir, mas isso previne erros)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome TEXT;

-- 2. Atualiza usuários antigos que não tinham nome (se houver algum)
-- Ele pega a primeira parte do email e coloca como nome provisório.
UPDATE public.profiles 
SET nome = SPLIT_PART(email, '@', 1) 
WHERE nome IS NULL OR trim(nome) = '';
