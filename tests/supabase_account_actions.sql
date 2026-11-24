-- LOCAL QA ONLY. Disposable PostgreSQL auth fixture; never run against real users.
BEGIN;
INSERT INTO public.aniloop_profiles(id,username) VALUES
 ('00000000-0000-0000-0000-000000000001','First_Player'),
 ('00000000-0000-0000-0000-000000000002','Other_Player');
INSERT INTO public.aniloop_wallets(user_id) SELECT id FROM public.aniloop_profiles;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.aniloop_export_own_account();
 IF result->'account'->>'email' <> 'one@example.test' OR result->'profile'->>'username' <> 'First_Player' THEN RAISE EXCEPTION 'Wrong export identity'; END IF;
 IF result::text LIKE '%two@example.test%' OR result::text LIKE '%never-export%' THEN RAISE EXCEPTION 'Export leaked data'; END IF;
 IF jsonb_array_length(result->'wallet')<>1 THEN RAISE EXCEPTION 'Export leaked wallets'; END IF;
 BEGIN
   PERFORM public.aniloop_delete_own_account();RAISE EXCEPTION 'Missing recent password allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Re-enter your password first' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch FROM now())::bigint-3600)))::text,true);
DO $$ BEGIN
 BEGIN
   PERFORM public.aniloop_delete_own_account();RAISE EXCEPTION 'Stale password allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Re-enter your password first' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','token_refresh','timestamp',extract(epoch FROM now())::bigint)))::text,true);
DO $$ BEGIN
 BEGIN
   PERFORM public.aniloop_delete_own_account();RAISE EXCEPTION 'Refresh-only token allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Re-enter your password first' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch FROM now())::bigint)))::text,true);
SELECT public.aniloop_delete_own_account();
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM auth.users WHERE id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Own deletion failed'; END IF;
 IF EXISTS(SELECT FROM public.aniloop_wallets WHERE user_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Cascade failed'; END IF;
 IF NOT EXISTS(SELECT FROM auth.users WHERE id='00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Other account deleted'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.aniloop_export_own_account();RAISE EXCEPTION 'Anonymous export allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.aniloop_delete_own_account();RAISE EXCEPTION 'Anonymous deletion allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
ROLLBACK;
