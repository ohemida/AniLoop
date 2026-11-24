-- LOCAL QA ONLY. Use the disposable PostgreSQL auth fixture, never Supabase production.
BEGIN;
SELECT public.aniloop_cloud_create_profile('00000000-0000-0000-0000-000000000003','Cloud_Player',true,'2026-11-24.5');
INSERT INTO public.aniloop_admins(user_id) VALUES('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE service_role;
SELECT public.aniloop_cloud_commit(
 '00000000-0000-0000-0000-000000000003','[]'::jsonb,
 '[{"key":"account:00000000-0000-0000-0000-000000000003","owner":"00000000-0000-0000-0000-000000000003","value":{"shards":100,"equipped":"classic","owned":[],"claims":[],"scores":[],"picture":null}}]'::jsonb,
 NULL,false);
DO $$ BEGIN
 IF (SELECT shards FROM public.aniloop_wallets WHERE user_id='00000000-0000-0000-0000-000000000003')<>100 THEN RAISE EXCEPTION 'Cloud account did not mirror wallet'; END IF;
END $$;
SELECT public.aniloop_cloud_commit(
 '00000000-0000-0000-0000-000000000001','[{"key":"account:00000000-0000-0000-0000-000000000003","revision":1}]'::jsonb,
 '[{"key":"account:00000000-0000-0000-0000-000000000003","owner":"00000000-0000-0000-0000-000000000003","value":{"shards":999,"equipped":"classic","owned":[],"claims":[],"scores":[],"picture":null}}]'::jsonb,
 NULL,true);
DO $$ BEGIN
 IF (SELECT shards FROM public.aniloop_wallets WHERE user_id='00000000-0000-0000-0000-000000000003')<>999 THEN RAISE EXCEPTION 'Admin balance change failed'; END IF;
 IF public.aniloop_cloud_commit('00000000-0000-0000-0000-000000000003','[{"key":"account:00000000-0000-0000-0000-000000000003","revision":1}]'::jsonb,'[]'::jsonb,NULL,false) THEN RAISE EXCEPTION 'Stale transaction was accepted'; END IF;
 BEGIN
  PERFORM public.aniloop_cloud_commit('00000000-0000-0000-0000-000000000002','[]'::jsonb,'[]'::jsonb,NULL,true);
  RAISE EXCEPTION 'Non-admin transaction accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Administrator access required' THEN RAISE; END IF; END;
END $$;
SELECT public.aniloop_cloud_submit_bug(repeat('a',64),'{"title":"Cloud report","category":"General","steps":"This is enough detail to reproduce","expected":"A result","actual":"This did not work","diagnostics":{}}'::jsonb);
SELECT public.aniloop_cloud_submit_bug(repeat('a',64),'{"title":"Cloud report","category":"General","steps":"This is enough detail to reproduce","expected":"A result","actual":"This did not work","diagnostics":{}}'::jsonb);
SELECT public.aniloop_cloud_submit_bug(repeat('a',64),'{"title":"Cloud report","category":"General","steps":"This is enough detail to reproduce","expected":"A result","actual":"This did not work","diagnostics":{}}'::jsonb);
DO $$ BEGIN
 BEGIN
  PERFORM public.aniloop_cloud_submit_bug(repeat('a',64),'{"title":"Cloud report","category":"General","steps":"This is enough detail to reproduce","expected":"A result","actual":"This did not work","diagnostics":{}}'::jsonb);
  RAISE EXCEPTION 'Bug report rate limit failed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Please wait before sending another report' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
