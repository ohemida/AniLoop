# GitHub Pages + Supabase setup

The Pages client uses the existing Supabase project URL and publishable key from `project.json`. That key is public by design. Never put a Supabase secret or service-role key in the Pages bundle.

## Database migration

The user has already applied the base `setup.sql` and `account_actions.sql` to this project. Run `cloud_runtime.sql` once in Supabase **SQL Editor**. It is additive: it creates private cloud state, an Edge-only profile initializer and rate-limited bug intake; it does not drop tables, touch local browser saves or migrate Python/SQLite accounts. Do not reset the project or rerun migrations by dropping existing data.

The Edge Function relies on the tables and owner-only RPCs from all three SQL files. Anonymous access to private state is denied. The browser never receives a service key. Admin access is not granted by username: after an account is created and verified, an operator must deliberately insert that user's UUID into `aniloop_admins` in the SQL Editor.

## Deploy the Edge Function

The function source is `functions/aniloop/index.ts`; `config.toml` disables platform JWT verification because the function itself validates each bearer token against Supabase Auth. It uses Supabase's automatically injected `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or publishable key) and `SUPABASE_SERVICE_ROLE_KEY` secrets.

The GitHub workflow `.github/workflows/deploy-supabase.yml` deploys only this function. To enable it:

1. In GitHub repository **Settings → Actions → General**, enable Actions.
2. In **Settings → Secrets and variables → Actions**, add `SUPABASE_ACCESS_TOKEN` with a Supabase personal access token. Keep it secret; never paste it into source or chat.
3. Run **Actions → Deploy AniLoop Supabase function → Run workflow**.

Alternatively, install the Supabase CLI and run `supabase login` followed by `supabase functions deploy aniloop --project-ref adxwsbaztwgjzvynobad` from the repository root. No deploy can happen until one of these authenticated paths is available.

For a different frontend host, configure the exact origin in Supabase Edge Function secret `ANILOOP_ALLOWED_ORIGINS`, comma-separated. The default allows `https://ohemida.github.io` and `http://localhost:8098`.

## Authentication URLs

In Supabase **Authentication → URL Configuration**, set Site URL to `https://ohemida.github.io/AniLoop/` and add that exact URL to Redirect URLs. For local preview, also allow `http://localhost:8098/`. Keep email confirmation enabled. Supabase confirmation must return to the same URL so the browser can exchange its PKCE code. Built-in email delivery may be rate-limited; configure a trusted SMTP provider before inviting users.

## Static Pages build

With Node.js 20+, run `npm run build:pages -- /tmp/aniloop-pages`. Upload that folder's **contents** to the Pages branch root, including `.nojekyll`. The resulting app is static and does not need Python at runtime. A local static server can be used for preview; its implementation is not part of the hosted app.

Pages provides the quiz UI and catalog. Supabase provides account authentication, private game-save sync, leaderboards, friendships, rewards, profile customization, reports and rooms. Existing browser saves and custom media are left in place and are not silently migrated. Opening/ending protected video hints are disabled in this static build: hint video files must be separately licensed, blurred/trimmed and uploaded to Supabase Storage before those clues can be enabled. Audio and screenshot sources remain external registered URLs.

## Verification status

The SQL migration and cloud service tests pass against a disposable local PostgreSQL fixture. This does not verify the user's live Supabase settings, Auth email delivery, SMTP, project backup settings or production function deployment. After deploying, test signup and confirmation, login/logout, private save sync, export/deletion, friends, leaderboard, rewards and Party/Co-op with two accounts. Do not announce the service as fully operational until those remote checks pass.
