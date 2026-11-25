-- Make an AniLoop account an administrator (run once in the Supabase SQL Editor).
-- Admin rights are stored by account id, so they survive every website or function update.
-- Replace Insider with your exact AniLoop username if it is different.
INSERT INTO public.aniloop_admins(user_id)
SELECT id FROM public.aniloop_profiles WHERE lower(username)=lower('Insider')
ON CONFLICT (user_id) DO NOTHING;

-- Check: should list your username.
SELECT p.username FROM public.aniloop_admins a JOIN public.aniloop_profiles p ON p.id=a.user_id;
