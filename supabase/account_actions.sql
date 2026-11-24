-- Add-on for an existing setup.sql project. Run in Supabase SQL Editor.
-- Does not delete accounts when installed. Only the signed-in owner can call it.
BEGIN;
ALTER TABLE public.aniloop_profiles ALTER COLUMN notice_version SET DEFAULT '2026-11-24.2';
CREATE OR REPLACE FUNCTION public.aniloop_export_own_account()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT jsonb_build_object(
   'account',(SELECT jsonb_build_object('id',id,'email',email,'created_at',created_at) FROM auth.users WHERE id=actor),
   'profile',(SELECT to_jsonb(p) FROM public.aniloop_profiles p WHERE id=actor),
   'scores',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.aniloop_scores s WHERE user_id=actor),'[]'::jsonb),
   'friendships',COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM public.aniloop_friendships f WHERE actor IN(user_low,user_high)),'[]'::jsonb),
   'wallet',COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.aniloop_wallets w WHERE user_id=actor),'[]'::jsonb),
   'cosmetics',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.aniloop_cosmetics c WHERE user_id=actor),'[]'::jsonb),
   'dailyClaims',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.aniloop_daily_claims d WHERE user_id=actor),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.aniloop_delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); methods jsonb := auth.jwt()->'amr';
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 -- Require a recent password authentication, not just a refreshed old token.
 IF jsonb_typeof(methods) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Re-enter your password first'; END IF;
 IF NOT EXISTS (
   SELECT FROM jsonb_array_elements(methods) m
   WHERE m->>'method'='password' AND
   CASE WHEN m->>'timestamp' ~ '^[0-9]{1,12}$'
     THEN extract(epoch FROM now())-(m->>'timestamp')::numeric BETWEEN -30 AND 300
     ELSE false END
 ) THEN RAISE EXCEPTION 'Re-enter your password first'; END IF;
 DELETE FROM auth.users WHERE id=actor;
END;
$$;
REVOKE ALL ON FUNCTION public.aniloop_export_own_account() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.aniloop_delete_own_account() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_export_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_delete_own_account() TO authenticated;
COMMIT;
