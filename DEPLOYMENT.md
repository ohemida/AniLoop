# Publish AniLoop

The repository can live on GitHub. The complete app needs a running Python backend: GitHub Pages only serves static files, so it cannot run accounts, SQLite leaderboards, or ffmpeg hints. See [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Create the upload folder

```bash
python3 scripts/prepare_release.py
```

Upload **`.release/AniLoop/`** as the root of your GitHub repository, including its `.github` folder. The script does not upload anything or create a GitHub repository. It refuses to overwrite an existing generated directory; use `--output /a/fresh/folder` for another copy.

The generated project replaces bundled media references with registered, on-demand source URLs. It contains the original logo and application code, but excludes bundled third-party anime files, databases, accounts, passwords, local configuration, browser test exports, and caches. External media availability and your permission to use those sources still need to be reviewed before a public launch. The generated folder requires internet for uncached media.

No software license is assumed on your behalf. Choose your preferred license before making the repository public. The application is not affiliated with AniGuessr or the media/catalog providers.

## Local start

Python 3.12+ with `ffmpeg`, `ffprobe`, and `curl` installed:

```bash
python3 server.py
```

Use the printed URL. Default port is 8097; if it is occupied, the launcher tries the next port. Explicit `--port` values are never silently changed. Restart the Python process after backend updates.

## Container deployment

A Dockerfile is included. Build and test locally:

```bash
docker build -t aniloop .
docker run --rm -p 8097:8097 -v aniloop-data:/app/.runtime -v aniloop-cache:/app/.tools aniloop
```

A public deployment needs a Docker-capable host with persistent storage. Use **one application instance** with SQLite. Mount `/app/.runtime` persistently; losing it loses accounts and rankings. `/app/.tools` holds disposable media caches. Back up the database with SQLite's backup API, for example `sqlite3.Connection.backup`, rather than copying it during a write.

Put the container behind an HTTPS reverse proxy, preserve the public Host header, and set:

```text
ANILOOP_SECURE_COOKIES=1
ANILOOP_PUBLIC_ORIGIN=https://your-domain.example
```

The origin must exactly match the public site origin, without a path. Keep frontend and API on the same origin. Do not set secure cookies when testing plain HTTP locally. Set request/body/rate/resource limits at the reverse proxy and hosting layer. The bundled Python server is a small single-node application server; it is not a managed production platform or a substitute for deployment review. No public deployment has been performed.

## Accounts and rankings

- Username/password accounts; public usernames use 3–24 letters, digits, underscores, or hyphens.
- Passwords use salted scrypt (`N=32768, r=8, p=3`), not plaintext.
- Session cookies are HttpOnly and SameSite=Lax; sessions expire after 30 days. Production HTTPS adds Secure.
- State-changing account APIs require same-origin JSON requests. Authentication attempts are rate-limited per direct client IP. Behind a proxy this can be shared by users; configure edge rate limits and adjust the application limiter for your deployment. Forwarded IP headers are deliberately not trusted automatically.
- SQLite stores only hashed session tokens. Sign-out revokes the session; account deletion requires the current password and removes sessions and scores.
- No email, email verification, password recovery, OAuth, or cross-device game saves are implemented. Make this clear to players.
- Players explicitly submit completed rounds; registration does not publish prior scores automatically.
- Best round per player, separate Daily/Infinity boards, all-time/rolling-week/UTC-today filters, top 100 players. Round count and earliest first result break ties.
- Duplicate Infinity seeds and duplicate Daily dates per account are rejected. The daily game resets locally; the board's Today filter uses UTC.
- The server recalculates scores from submitted answer strings and hints. It rejects incomplete/default-pool mismatches and ignores client score totals. **This is a community leaderboard, not a cheat-proof competitive system:** questions, answers, hint use, and timing originate in an inspectable local game. A competitive ranked mode needs server-issued challenges and a server-owned event history.
- Older saved rounds lack the per-question hint records required for submission. Finish a new round to enter a leaderboard.

## Checks

```bash
node --test tests/core.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

GitHub Actions runs these checks on pushes and pull requests. Browser tests additionally use Playwright/Chromium. See `tests/community_browser.py` for account and leaderboard flows.

## Multiplayer and daily rewards

The same persistent SQLite database now includes room membership/state, reward claims, streak history, wallets, and cosmetic ownership. Run the updated backend after deploying frontend changes; older processes will not have the new endpoints. Keep a single application instance and persistent database storage. Room operations and reward spending use SQLite transactions to prevent double submissions, duplicate claims, or double charges.

Rooms support up to eight accounts, Party and Co-op Infinity modes, six-character codes, host-controlled synchronized questions, and a shared eight-hint budget for co-op. They poll every 1.5 seconds rather than using WebSockets. Audio/video playback remains controlled by each browser because autoplay permissions and network timing differ; room question advancement is synchronized. Players can resume after a refresh and the next member becomes host when the current host leaves. The host can remove a disconnected member. Joining after a game has started is not supported. Room scores are not automatically added to solo leaderboards.

Room codes are unlisted invitations, not public matchmaking. All participants must access the same server origin. `localhost` links cannot connect friends on different computers. For a LAN-only test, run `python3 server.py --host 0.0.0.0 --port 8097` and use the host machine's LAN address; use HTTPS and the previously documented public origin/cookie settings for internet deployment.

Daily rewards require a complete default-pool daily round and a signed-in account. Claims are limited by both quiz date and UTC claim day. The UTC reward reset can differ from the quiz's local-midnight reset. Players receive 100 shards, plus 50 every seventh consecutive claim day; coins buy cosmetic profile frames only. These are community game rewards, not an anti-cheat or real-money economy. Badge history survives a broken streak. Account deletion cascades to its claims, wallet, inventory, and membership. Inactive rooms expire after 24 hours and are cleaned when room endpoints are used.

Hint transformation version `opening-window-v3-fast` invalidates earlier derivatives without deleting original media or account data. Openings contain only their configured window (35–65% by default); endings are complete and seekable from zero, with a blurred cover. Both audio tracks stay complete. These rules apply to Solo, Party and Co-op. Restart the backend when updating.

The Friends feature adds the `friendships` table to the existing SQLite database through an additive startup migration. Keep the same persistent database; do not replace it. Deploy `friends.py` and `assets/friends-ui.js`, and restart the backend. `/api/health` reports `friendsApi: 1`. Friends compare explicitly submitted daily and Infinity results on the same server. They do not synchronize browser saves or publish scores automatically. Include `tests/friends_browser.py` in browser QA with a separate disposable `ANILOOP_DB`.
