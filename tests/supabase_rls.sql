-- LOCAL QA ONLY: requires disposable PostgreSQL auth.users/roles/auth.uid fixtures.
-- Never run this fixture against real Supabase Auth users.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.aniloop_create_profile('First_Player',false);
    RAISE EXCEPTION 'Expected adult declaration rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'AniLoop is for adults aged 18 or over' THEN RAISE; END IF;
  END;
END $$;
SELECT public.aniloop_create_profile('First_Player',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT public.aniloop_create_profile('Second_Player',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT public.aniloop_create_profile('Other_Player',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.aniloop_wallets) <> 1 THEN RAISE EXCEPTION 'Wallet RLS failed'; END IF;
  BEGIN
    UPDATE public.aniloop_wallets SET shards=99999;
    RAISE EXCEPTION 'Client changed balance';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.aniloop_scores(user_id,mode,seed,score,breakdown)
      VALUES(auth.uid(),'infinity','fake',100000,'{}');
    RAISE EXCEPTION 'Client inserted score';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM adult_declared_at FROM public.aniloop_profiles;
    RAISE EXCEPTION 'Private profile field exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.aniloop_friendships(user_low,user_high,requested_by)
 VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',auth.uid());
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.aniloop_friendships SET status='accepted';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Sender accepted own request'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.aniloop_friendships) <> 0 THEN RAISE EXCEPTION 'Bystander sees friendship'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ DECLARE affected integer; BEGIN
 UPDATE public.aniloop_friendships SET status='accepted';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Recipient cannot accept request'; END IF;
 DELETE FROM public.aniloop_friendships;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Participant cannot remove friendship'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
   PERFORM id FROM public.aniloop_profiles;
   RAISE EXCEPTION 'Anonymous profile access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.aniloop_create_profile('Anonymous',true);
   RAISE EXCEPTION 'Anonymous profile RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.aniloop_profiles WHERE id='00000000-0000-0000-0000-000000000001')
 OR EXISTS(SELECT FROM public.aniloop_wallets WHERE user_id='00000000-0000-0000-0000-000000000001')
 THEN RAISE EXCEPTION 'Account cascade failed'; END IF;
END $$;
ROLLBACK;
