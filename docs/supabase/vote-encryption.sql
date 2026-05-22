-- NewsHub — Vote Encryption via pgcrypto
-- Run in Supabase SQL Editor.
--
-- Supabase hosted projects cannot use ALTER DATABASE ... SET custom parameters
-- (permission denied 42501). The key is stored in vote_encryption_config instead.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS encrypted_candidate_id BYTEA;

-- Single-row table holds the symmetric key (not exposed via RLS to clients).
CREATE TABLE IF NOT EXISTS public.vote_encryption_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  encryption_key TEXT NOT NULL
);

ALTER TABLE public.vote_encryption_config ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only SECURITY DEFINER functions read this table.

-- ⚠️ REPLACE the placeholder with a real random 32-character key.
-- Generate one with: openssl rand -base64 24
-- Store a backup in Supabase Dashboard → Settings → Vault for production.
INSERT INTO public.vote_encryption_config (id, encryption_key)
VALUES (1, 'REPLACE_WITH_REAL_32_CHAR_KEY!!!')
ON CONFLICT (id) DO UPDATE SET encryption_key = EXCLUDED.encryption_key;

REVOKE ALL ON TABLE public.vote_encryption_config FROM PUBLIC;
REVOKE ALL ON TABLE public.vote_encryption_config FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_vote_encryption_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encryption_key FROM public.vote_encryption_config WHERE id = 1 LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_vote_encryption_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vote_encryption_key() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.encrypt_vote_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  enc_key := public.get_vote_encryption_key();
  IF enc_key IS NULL OR enc_key = '' THEN
    RAISE EXCEPTION 'Vote encryption key is not configured';
  END IF;
  NEW.encrypted_candidate_id := pgp_sym_encrypt(
    NEW.candidate_id::TEXT,
    enc_key
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_vote ON public.votes;
CREATE TRIGGER trg_encrypt_vote
BEFORE INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_vote_candidate();

CREATE OR REPLACE FUNCTION public.decrypt_vote(vote_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc BYTEA;
  enc_key TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = (auth.jwt() ->> 'email')
    AND role = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  SELECT encrypted_candidate_id INTO enc
  FROM public.votes WHERE id = vote_id;
  IF enc IS NULL THEN
    RAISE EXCEPTION 'Vote not found or not yet encrypted';
  END IF;
  enc_key := public.get_vote_encryption_key();
  RETURN pgp_sym_decrypt(enc, enc_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrypt_vote(BIGINT) TO authenticated;

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'votes';
