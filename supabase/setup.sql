-- AniLoop Supabase foundation, v1. Run once in Supabase SQL Editor.
-- Additive, namespaced tables. No existing users/data are migrated or deleted.
-- Supabase Auth owns passwords/email/sessions: never create a password column here.
-- This does NOT connect the existing Python/SQLite application to Supabase.
BEGIN;

CREATE TABLE public.aniloop_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL CHECK (username ~ '^[A-Za-z0-9_-]{3,24}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    adult_declared_at timestamptz NOT NULL DEFAULT now(),
    notice_version text NOT NULL DEFAULT '2026-11-24.2'
);
CREATE UNIQUE INDEX aniloop_username_unique ON public.aniloop_profiles (lower(username));

CREATE TABLE public.aniloop_friendships (
    user_low uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    user_high uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    requested_by uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_low,user_high),
    CHECK(user_low < user_high),
    CHECK(requested_by IN (user_low,user_high))
);
CREATE INDEX aniloop_friendships_high ON public.aniloop_friendships(user_high,status);

-- Trusted backend must validate completed rounds before writing these rows.
-- No client insert/update grant: a browser cannot award itself points or shards.
CREATE TABLE public.aniloop_scores (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    mode text NOT NULL CHECK(mode IN ('daily','infinity')),
    seed text NOT NULL CHECK(length(seed) BETWEEN 1 AND 250),
    quiz_day date,
    score integer NOT NULL CHECK(score BETWEEN 0 AND 100000),
    breakdown jsonb NOT NULL CHECK(jsonb_typeof(breakdown)='object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id,mode,seed),
    CHECK(mode <> 'daily' OR quiz_day IS NOT NULL)
);
CREATE INDEX aniloop_scores_ranking ON public.aniloop_scores(mode,created_at,score DESC);

CREATE TABLE public.aniloop_wallets (
    user_id uuid PRIMARY KEY REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    shards integer NOT NULL DEFAULT 0 CHECK(shards >= 0),
    equipped text NOT NULL DEFAULT 'classic'
      CHECK(equipped IN ('classic','silver','orbit','starlit','fern','ink','lunar','sakura','neon','ember','aurora','holo','galaxy'))
);
CREATE TABLE public.aniloop_cosmetics (
    user_id uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    item text NOT NULL CHECK(item IN ('silver','orbit','starlit','fern','ink','lunar','sakura','neon','ember','aurora','holo','galaxy')),
    PRIMARY KEY(user_id,item)
);
CREATE TABLE public.aniloop_daily_claims (
    user_id uuid NOT NULL REFERENCES public.aniloop_profiles(id) ON DELETE CASCADE,
    claim_day date NOT NULL,
    seed text NOT NULL,
    amount integer NOT NULL CHECK(amount IN (100,150)),
    score integer NOT NULL CHECK(score BETWEEN 0 AND 100000),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id,claim_day),
    UNIQUE(user_id,seed)
);

ALTER TABLE public.aniloop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aniloop_daily_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.aniloop_profiles,public.aniloop_friendships,
    public.aniloop_scores,public.aniloop_wallets,public.aniloop_cosmetics,
    public.aniloop_daily_claims FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.aniloop_scores_id_seq FROM PUBLIC,anon,authenticated;

-- Logged-in people can discover public usernames; private age metadata stays hidden.
GRANT SELECT(id,username,created_at) ON public.aniloop_profiles TO authenticated;
CREATE POLICY aniloop_profiles_read ON public.aniloop_profiles
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

GRANT SELECT,DELETE ON public.aniloop_friendships TO authenticated;
GRANT INSERT(user_low,user_high,requested_by) ON public.aniloop_friendships TO authenticated;
GRANT UPDATE(status) ON public.aniloop_friendships TO authenticated;
CREATE POLICY aniloop_friends_read ON public.aniloop_friendships FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) IN (user_low,user_high));
CREATE POLICY aniloop_friends_request ON public.aniloop_friendships FOR INSERT TO authenticated
    WITH CHECK (requested_by=(SELECT auth.uid()) AND status='pending'
        AND (SELECT auth.uid()) IN (user_low,user_high));
CREATE POLICY aniloop_friends_accept ON public.aniloop_friendships FOR UPDATE TO authenticated
    USING (status='pending' AND requested_by<>(SELECT auth.uid())
        AND (SELECT auth.uid()) IN (user_low,user_high))
    WITH CHECK (status='accepted' AND requested_by<>(SELECT auth.uid())
        AND (SELECT auth.uid()) IN (user_low,user_high));
CREATE POLICY aniloop_friends_remove ON public.aniloop_friendships FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) IN (user_low,user_high));

-- Only explicitly submitted score summaries belong in this table. Never put answers here.
GRANT SELECT ON public.aniloop_scores TO authenticated;
CREATE POLICY aniloop_scores_read ON public.aniloop_scores FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL);
GRANT SELECT ON public.aniloop_wallets,public.aniloop_cosmetics,public.aniloop_daily_claims TO authenticated;
CREATE POLICY aniloop_wallet_read ON public.aniloop_wallets FOR SELECT TO authenticated
    USING (user_id=(SELECT auth.uid()));
CREATE POLICY aniloop_cosmetics_read ON public.aniloop_cosmetics FOR SELECT TO authenticated
    USING (user_id=(SELECT auth.uid()));
CREATE POLICY aniloop_claims_read ON public.aniloop_daily_claims FOR SELECT TO authenticated
    USING (user_id=(SELECT auth.uid()));

-- Narrow RPC: creates only the signed-in user's adult-declared profile and zero wallet.
-- No user-metadata trust, arbitrary UUID parameter, password, role or balance input.
CREATE FUNCTION public.aniloop_create_profile(p_username text,p_adult_confirmed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    actor uuid := auth.uid();
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
    IF p_adult_confirmed IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'AniLoop is for adults aged 18 or over';
    END IF;
    IF p_username IS NULL OR p_username !~ '^[A-Za-z0-9_-]{3,24}$' THEN
        RAISE EXCEPTION 'Username must contain 3–24 letters, digits, underscores or hyphens';
    END IF;
    INSERT INTO public.aniloop_profiles(id,username) VALUES(actor,p_username);
    INSERT INTO public.aniloop_wallets(user_id) VALUES(actor);
END;
$$;
REVOKE ALL ON FUNCTION public.aniloop_create_profile(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aniloop_create_profile(text,boolean) TO authenticated;

-- Reserved for a trusted backend, never for the browser publishable key.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.aniloop_profiles,public.aniloop_friendships,
    public.aniloop_scores,public.aniloop_wallets,public.aniloop_cosmetics,
    public.aniloop_daily_claims TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.aniloop_scores_id_seq TO service_role;

COMMIT;
