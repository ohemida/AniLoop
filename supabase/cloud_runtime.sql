-- Additive cloud runtime after setup.sql + account_actions.sql. Installs no admin grants.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aniloop_runtime (
 key text PRIMARY KEY CHECK(length(key) BETWEEN 3 AND 250),
 owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'),
 revision bigint NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.aniloop_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.aniloop_bug_rate(digest text PRIMARY KEY CHECK(digest ~ '^[a-f0-9]{64}$'),window_start timestamptz NOT NULL,count integer NOT NULL);
ALTER TABLE public.aniloop_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aniloop_runtime,public.aniloop_admins FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.aniloop_runtime,public.aniloop_admins TO service_role;
REVOKE ALL ON public.aniloop_bug_rate FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.aniloop_bug_rate TO service_role;

CREATE OR REPLACE FUNCTION public.aniloop_cloud_commit(p_actor uuid,p_reads jsonb,p_writes jsonb,p_score jsonb DEFAULT NULL,p_admin boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; current_revision bigint; v jsonb; uid uuid;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF jsonb_typeof(p_reads)<>'array' OR jsonb_typeof(p_writes)<>'array' OR jsonb_array_length(p_reads)>500 OR jsonb_array_length(p_writes)>500 THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
 -- Serialize short commits only. The Edge Function computes game logic before this lock.
 PERFORM pg_advisory_xact_lock(871026482);
 IF p_admin THEN
  PERFORM 1 FROM public.aniloop_admins WHERE user_id=p_actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_reads) LOOP
  SELECT revision INTO current_revision FROM public.aniloop_runtime WHERE key=r->>'key';
  IF COALESCE(current_revision,0)<>(r->>'revision')::bigint THEN RETURN false; END IF;
 END LOOP;
 IF p_score IS NOT NULL THEN
  INSERT INTO public.aniloop_scores(user_id,mode,seed,quiz_day,score,breakdown)
   VALUES(p_actor,p_score->>'mode',p_score->>'seed',CASE WHEN p_score->>'mode'='daily' THEN (p_score->>'seed')::date END,(p_score->>'score')::integer,p_score->'breakdown');
 END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_writes) LOOP
  IF r->>'delete'='true' THEN DELETE FROM public.aniloop_runtime WHERE key=r->>'key';
  ELSE
   v=r->'value';uid=NULLIF(r->>'owner','')::uuid;
   INSERT INTO public.aniloop_runtime(key,owner_id,value) VALUES(r->>'key',uid,v)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,revision=public.aniloop_runtime.revision+1,updated_at=now();
   IF r->>'key'='account:'||uid::text THEN
    INSERT INTO public.aniloop_wallets(user_id,shards,equipped) VALUES(uid,(v->>'shards')::integer,v->>'equipped')
     ON CONFLICT(user_id) DO UPDATE SET shards=excluded.shards,equipped=excluded.equipped;
    DELETE FROM public.aniloop_cosmetics WHERE user_id=uid;
    INSERT INTO public.aniloop_cosmetics(user_id,item) SELECT uid,jsonb_array_elements_text(v->'owned');
    INSERT INTO public.aniloop_daily_claims(user_id,claim_day,seed,amount,score)
     SELECT uid,(x->>'day')::date,x->>'seed',(x->>'amount')::integer,(x->>'score')::integer FROM jsonb_array_elements(v->'claims') x
     ON CONFLICT DO NOTHING;
   END IF;
  END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_commit(uuid,jsonb,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_cloud_commit(uuid,jsonb,jsonb,jsonb,boolean) TO service_role;

-- The Pages build creates profiles only after Edge has checked the signup fields.
-- Keeping this privileged also prevents the browser from assigning profile data.
CREATE OR REPLACE FUNCTION public.aniloop_cloud_create_profile(p_actor uuid,p_username text,p_adult_confirmed boolean,p_notice_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_adult_confirmed IS DISTINCT FROM true OR p_notice_version IS DISTINCT FROM '2026-11-24.5' THEN RAISE EXCEPTION 'Confirm the adult account and current privacy notice'; END IF;
 IF p_username IS NULL OR p_username !~ '^[A-Za-z0-9_-]{3,24}$' THEN RAISE EXCEPTION 'Invalid username'; END IF;
 INSERT INTO public.aniloop_profiles(id,username,notice_version) VALUES(p_actor,p_username,p_notice_version);
 INSERT INTO public.aniloop_wallets(user_id) VALUES(p_actor) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_create_profile(uuid,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_cloud_create_profile(uuid,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.aniloop_cloud_submit_bug(p_digest text,p_report jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE used integer; report_id text := gen_random_uuid()::text;
BEGIN
 IF p_digest !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_report)<>'object' THEN RAISE EXCEPTION 'Invalid report'; END IF;
 IF NOT (p_report ?& ARRAY['title','category','steps','expected','actual','diagnostics']) OR length(p_report->>'title') NOT BETWEEN 5 AND 120 OR length(p_report->>'steps') NOT BETWEEN 10 AND 3000 OR length(p_report->>'actual') NOT BETWEEN 10 AND 3000 THEN RAISE EXCEPTION 'Invalid report'; END IF;
 INSERT INTO public.aniloop_bug_rate(digest,window_start,count) VALUES(p_digest,now(),1)
 ON CONFLICT(digest) DO UPDATE SET window_start=CASE WHEN public.aniloop_bug_rate.window_start<now()-interval '1 hour' THEN now() ELSE public.aniloop_bug_rate.window_start END,
 count=CASE WHEN public.aniloop_bug_rate.window_start<now()-interval '1 hour' THEN 1 ELSE public.aniloop_bug_rate.count+1 END;
 SELECT b.count INTO used FROM public.aniloop_bug_rate b WHERE b.digest=p_digest;
 IF used>3 THEN RAISE EXCEPTION 'Please wait before sending another report'; END IF;
 INSERT INTO public.aniloop_runtime(key,owner_id,value) VALUES('report:'||report_id,NULL,p_report||jsonb_build_object('created',extract(epoch FROM now())::bigint));
 DELETE FROM public.aniloop_bug_rate WHERE window_start<now()-interval '7 days';
 -- Privacy policy promise: bug reports are kept for at most 90 days.
 DELETE FROM public.aniloop_runtime WHERE key LIKE 'report:%' AND (value->>'created')::bigint < extract(epoch FROM now()-interval '90 days')::bigint;
 RETURN report_id;
END $$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_submit_bug(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_cloud_submit_bug(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.aniloop_cloud_leaderboard(p_mode text,p_period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_mode NOT IN ('daily','infinity') OR p_period NOT IN ('all','week','today') THEN RAISE EXCEPTION 'Invalid leaderboard filter'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO result FROM (
  SELECT p.id AS "userId",p.username,max(s.score) AS score,count(*)::integer AS rounds
  FROM public.aniloop_scores s JOIN public.aniloop_profiles p ON p.id=s.user_id
  WHERE s.mode=p_mode AND (p_period='all' OR s.created_at>=CASE WHEN p_period='week' THEN now()-interval '7 days' ELSE date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' END)
  GROUP BY p.id,p.username ORDER BY max(s.score) DESC,count(*) DESC,min(s.created_at),lower(p.username) LIMIT 100
 ) t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_leaderboard(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_cloud_leaderboard(text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.aniloop_cloud_friend_scores(p_ids uuid[],p_day date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u,'bestInfinity',(SELECT max(score) FROM public.aniloop_scores WHERE user_id=u AND mode='infinity'),'infinityRounds',(SELECT count(*) FROM public.aniloop_scores WHERE user_id=u AND mode='infinity'),'daily',(SELECT COALESCE(jsonb_agg(jsonb_build_object('day',quiz_day,'score',score,'breakdown',breakdown)),'[]'::jsonb) FROM public.aniloop_scores WHERE user_id=u AND mode='daily' AND quiz_day BETWEEN p_day-6 AND p_day))),'[]'::jsonb)
 FROM unnest(p_ids[1:201]) u
$$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_friend_scores(uuid[],date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_cloud_friend_scores(uuid[],date) TO service_role;

CREATE OR REPLACE FUNCTION public.aniloop_cloud_scrub_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; members jsonb; v jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(871026482);
 DELETE FROM public.aniloop_runtime WHERE key LIKE 'friend:%' AND value->'members' ? OLD.id::text;
 UPDATE public.aniloop_runtime SET value=jsonb_set(value,'{ids}',(value->'ids')-OLD.id::text),revision=revision+1 WHERE key LIKE 'friends:%' AND value->'ids' ? OLD.id::text;
 FOR r IN SELECT key,value FROM public.aniloop_runtime WHERE key LIKE 'room:%' AND EXISTS(SELECT 1 FROM jsonb_array_elements(value->'members') m WHERE m->>'id'=OLD.id::text) LOOP
  SELECT COALESCE(jsonb_agg(m),'[]'::jsonb) INTO members FROM jsonb_array_elements(r.value->'members') m WHERE m->>'id'<>OLD.id::text;
  IF jsonb_array_length(members)=0 THEN DELETE FROM public.aniloop_runtime WHERE key=r.key;
  ELSE
   v=jsonb_set(r.value,'{members}',members);
   IF v->'state' ? 'players' THEN v=jsonb_set(v,'{state,players}',(v->'state'->'players')-OLD.id::text); END IF;
   IF v->>'owner'=OLD.id::text THEN v=jsonb_set(v,'{owner}',members->0->'id'); END IF;
   v=jsonb_set(v,'{revision}',to_jsonb((v->>'revision')::integer+1));
   UPDATE public.aniloop_runtime SET value=v,revision=revision+1 WHERE key=r.key;
  END IF;
 END LOOP;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.aniloop_cloud_scrub_user() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS aniloop_cloud_scrub_deleted_user ON auth.users;
CREATE TRIGGER aniloop_cloud_scrub_deleted_user BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.aniloop_cloud_scrub_user();
COMMIT;

-- Profile frames (safe to rerun): allow the frames added after the first setup.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname,conrelid::regclass AS tbl FROM pg_constraint
  WHERE contype='c' AND conrelid IN ('public.aniloop_wallets'::regclass,'public.aniloop_cosmetics'::regclass)
  AND (pg_get_constraintdef(oid) LIKE '%equipped%' OR pg_get_constraintdef(oid) LIKE '%item%') LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.tbl,c.conname);
 END LOOP;
END $$;
ALTER TABLE public.aniloop_wallets ADD CONSTRAINT aniloop_wallets_equipped_known CHECK(equipped IN ('classic','silver','orbit','starlit','fern','ink','lunar','sakura','neon','ember','aurora','holo','galaxy'));
ALTER TABLE public.aniloop_cosmetics ADD CONSTRAINT aniloop_cosmetics_item_known CHECK(item IN ('silver','orbit','starlit','fern','ink','lunar','sakura','neon','ember','aurora','holo','galaxy'));
