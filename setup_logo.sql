-- 🚀 SCRIPT DE CONFIGURAÇÃO: TABELA SETTINGS (LOGO)
-- Copie e rode este código no SQL Editor do Supabase.

-- 1. Cria a tabela de configurações gerais (se não existir)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  value TEXT
);

-- 2. Habilita segurança em nível de linha (RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança:
-- Permite que qualquer pessoa leia as configurações (ex: logo do site)
DROP POLICY IF EXISTS "Settings públicos para leitura" ON public.settings;
CREATE POLICY "Settings públicos para leitura" ON public.settings FOR SELECT USING (true);

-- Permite que APENAS administradores alterem as configurações
DROP POLICY IF EXISTS "Apenas admin pode alterar settings" ON public.settings;
CREATE POLICY "Apenas admin pode alterar settings" ON public.settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
