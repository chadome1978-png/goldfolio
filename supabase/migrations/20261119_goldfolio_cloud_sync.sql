-- Goldfolio-only additive cloud-sync schema for BNK.
-- This migration does not inspect, alter, or remove RoomRent tables or objects.

CREATE TABLE IF NOT EXISTS public.goldfolio_holdings (
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 512),
  holding_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  gold_photo jsonb CHECK (gold_photo IS NULL OR jsonb_typeof(gold_photo) = 'object'),
  gold_photo_path text,
  warranty_document jsonb CHECK (warranty_document IS NULL OR jsonb_typeof(warranty_document) = 'object'),
  warranty_document_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (owner_id, holding_id),
  CHECK ((gold_photo IS NULL) = (gold_photo_path IS NULL)),
  CHECK ((warranty_document IS NULL) = (warranty_document_path IS NULL))
);

CREATE INDEX IF NOT EXISTS goldfolio_holdings_owner_updated_idx
  ON public.goldfolio_holdings (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.goldfolio_preferences (
  owner_id text PRIMARY KEY CHECK (length(owner_id) BETWEEN 1 AND 512),
  cloud_sync_enabled boolean NOT NULL DEFAULT false,
  manual_quote jsonb CHECK (manual_quote IS NULL OR jsonb_typeof(manual_quote) = 'object'),
  manual_quote_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

ALTER TABLE public.goldfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goldfolio_holdings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goldfolio_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goldfolio_preferences FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.goldfolio_holdings, public.goldfolio_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.goldfolio_holdings, public.goldfolio_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.goldfolio_upsert_holding(
  p_owner_id text,
  p_holding_id uuid,
  p_payload jsonb,
  p_gold_photo jsonb,
  p_gold_photo_path text,
  p_warranty_document jsonb,
  p_warranty_document_path text,
  p_updated_at timestamptz,
  p_deleted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.goldfolio_holdings%ROWTYPE;
  v_applied boolean := false;
BEGIN
  IF p_owner_id IS NULL OR length(p_owner_id) NOT BETWEEN 1 AND 512 THEN
    RAISE EXCEPTION 'invalid owner id';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid holding payload';
  END IF;
  IF p_updated_at IS NULL THEN
    RAISE EXCEPTION 'updated_at is required';
  END IF;

  INSERT INTO public.goldfolio_holdings (
    owner_id, holding_id, payload, gold_photo, gold_photo_path,
    warranty_document, warranty_document_path, updated_at, deleted_at
  ) VALUES (
    p_owner_id, p_holding_id, p_payload, p_gold_photo, p_gold_photo_path,
    p_warranty_document, p_warranty_document_path, p_updated_at, p_deleted_at
  )
  ON CONFLICT (owner_id, holding_id) DO UPDATE SET
    payload = EXCLUDED.payload,
    gold_photo = EXCLUDED.gold_photo,
    gold_photo_path = EXCLUDED.gold_photo_path,
    warranty_document = EXCLUDED.warranty_document,
    warranty_document_path = EXCLUDED.warranty_document_path,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at
  WHERE public.goldfolio_holdings.updated_at < EXCLUDED.updated_at
  RETURNING * INTO v_row;

  v_applied := FOUND;
  IF NOT v_applied THEN
    SELECT * INTO v_row
    FROM public.goldfolio_holdings
    WHERE owner_id = p_owner_id AND holding_id = p_holding_id;
  END IF;

  RETURN jsonb_build_object('applied', v_applied, 'row', to_jsonb(v_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.goldfolio_upsert_holding(text, uuid, jsonb, jsonb, text, jsonb, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goldfolio_upsert_holding(text, uuid, jsonb, jsonb, text, jsonb, text, timestamptz, timestamptz) TO service_role;

-- The bucket is private. This restrictive policy denies direct browser-role access
-- to this bucket while leaving policy behavior for every other bucket unchanged.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'goldfolio-attachments',
  'goldfolio-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'goldfolio_server_only'
  ) THEN
    CREATE POLICY goldfolio_server_only
      ON storage.objects
      AS RESTRICTIVE
      FOR ALL
      TO PUBLIC
      USING (bucket_id <> 'goldfolio-attachments')
      WITH CHECK (bucket_id <> 'goldfolio-attachments');
  END IF;
END;
$policy$;
