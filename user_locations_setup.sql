-- ═══════════════════════════════════════════════════════════
-- TABELA: user_locations
-- Armazena até 3 endereços por usuário no Supabase.
-- Execute no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_locations (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Meu Endereço',
  icon        TEXT NOT NULL DEFAULT '📍',
  street      TEXT NOT NULL,
  number      TEXT,
  complement  TEXT,
  neighborhood TEXT,
  city        TEXT NOT NULL DEFAULT 'São Gonçalo',
  lat         DOUBLE PRECISION,  -- latitude opcional (do GPS)
  lng         DOUBLE PRECISION,  -- longitude opcional (do GPS)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscar endereços por usuário rapidamente
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id
  ON public.user_locations(user_id);

-- Garantia de no máximo 3 endereços por usuário (via trigger)
CREATE OR REPLACE FUNCTION check_location_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.user_locations WHERE user_id = NEW.user_id
  ) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 endereços por usuário atingido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_location_limit ON public.user_locations;
CREATE TRIGGER enforce_location_limit
  BEFORE INSERT ON public.user_locations
  FOR EACH ROW EXECUTE FUNCTION check_location_limit();

-- Atualiza o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.user_locations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ── ROW LEVEL SECURITY (RLS) ─────────────────────────────────
-- Cada usuário só vê e edita os próprios endereços.

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Política: SELECT — só o próprio usuário vê seus endereços
CREATE POLICY "user_locations_select" ON public.user_locations
  FOR SELECT USING (auth.uid() = user_id);

-- Política: INSERT — usuário só insere para si mesmo
CREATE POLICY "user_locations_insert" ON public.user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: DELETE — usuário só remove os próprios
CREATE POLICY "user_locations_delete" ON public.user_locations
  FOR DELETE USING (auth.uid() = user_id);
