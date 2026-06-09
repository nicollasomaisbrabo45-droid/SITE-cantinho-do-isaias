-- Criação da tabela de perfis de usuário (Profiles) para armazenar o ID de Reconhecimento
-- Útil se você for usar o banco de dados do Supabase ou PostgreSQL.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  id_reconhecimento VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Função para gerar o ID de reconhecimento automaticamente (Ex: #TDS1828)
-- Regra: # + 3 Letras (do email antes do @) + 4 Números (aleatórios) = 8 caracteres
CREATE OR REPLACE FUNCTION public.generate_reconhecimento_id(user_email TEXT)
RETURNS VARCHAR(8) AS $$
DECLARE
  prefix TEXT;
  letters TEXT := '';
  numbers TEXT;
  new_id VARCHAR(8);
  is_unique BOOLEAN := FALSE;
BEGIN
  -- 1. Pegar a parte antes do @ e remover números
  prefix := REGEXP_REPLACE(SPLIT_PART(user_email, '@', 1), '[0-9]', '', 'g');
  prefix := UPPER(prefix);
  
  -- 2. Pegar até 3 letras do prefixo
  letters := SUBSTRING(prefix, 1, 3);
  
  -- Preencher com letras aleatórias caso o email não tenha 3 letras
  WHILE LENGTH(letters) < 3 LOOP
    letters := letters || CHR(TRUNC(RANDOM() * 26)::INT + 65);
  END LOOP;

  -- 3. Gerar o ID e garantir que seja único no banco de dados
  WHILE NOT is_unique LOOP
    -- Gerar 4 números aleatórios (de 1000 a 9999)
    numbers := (TRUNC(RANDOM() * 8999) + 1000)::TEXT;
    new_id := '#' || letters || numbers;
    
    -- Checar se o ID já existe na tabela profiles
    PERFORM 1 FROM public.profiles WHERE id_reconhecimento = new_id;
    IF NOT FOUND THEN
      is_unique := TRUE;
    END IF;
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger que roda ANTES de inserir na tabela profiles
-- Para gerar o id_reconhecimento automaticamente caso venha vazio
CREATE OR REPLACE FUNCTION public.trigger_generate_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_reconhecimento IS NULL THEN
    NEW.id_reconhecimento := generate_reconhecimento_id(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Associa o trigger à tabela
CREATE TRIGGER before_insert_profile
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_id();

-- Opcional: Trigger para inserir automaticamente um profile quando um usuário loga/registra no Supabase (auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, id_reconhecimento)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    -- Podemos usar o id do metadata se o front-end passar, ou deixar o DB gerar
    COALESCE(NEW.raw_user_meta_data->>'reconhecimento_id', generate_reconhecimento_id(NEW.email))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
