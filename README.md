# AniLoop

English anime quiz with five categories, a daily challenge, complete music tracks, and Infinity rounds. Open this folder in IntelliJ IDEA, WebStorm, or Codex.

## Run locally

Requirements: Python 3.12+, `curl`, `ffmpeg`, and `ffprobe` on your PATH. Install the Python dependencies for encrypted Supabase sessions. Docker installs them automatically. No npm installation is needed.

```bash
cd /home/insider/IdeaProjects/AniLoop
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 server.py
```

Open **http://localhost:8097**. Restart an older running server to load the new media-processing endpoints. If the default port is occupied, the launcher automatically tries the next free port and prints its URL. Use `python3 server.py --port 8098` to require a specific port. An old running Python process must be restarted to load backend changes; the interface now identifies a missing/outdated hint API explicitly. The server binds to localhost only. `bash start.sh` is also available.

## Games and scoring

Complete all five categories before starting another Infinity round. Play categories in any order. Choices and progress survive reloads. The daily quiz changes at local midnight.

| Category | Questions | Scoring |
|---|---|---|
| Screenshots | Easy, Medium, Hard | 10,000 each; each of three sequential clues costs 2,500 |
| Characters | Three sets of four portraits | 2,000 per name plus 500 per anime; partial answers count |
| Openings | Easy, Medium, Hard | 5,000 each; video clue costs 2,500 once |
| Endings | Easy, Medium, Hard | 5,000 each; video and cover clue cost 2,500 once |
| Anidle | Up to 22 guesses | 10,000 on guesses 1–3, then minus 500 per guess, including skips |

Maximum round score: **100,000**.

**Category loop** (`⟳ Category loop` in the mode switch, route `#game/<category>?mode=loop`) lets you play a single category endlessly: every loop round has three questions (one game for Anidle), and one click starts the next round. Each category keeps its own round counter, best score and average in `state.loops` / `state.loopStats`; Infinity, daily and leaderboard data are untouched. Anidle unlocks its blurred cover at guess 13, synopsis at 18, and most popular character at 22. Its summary shows only evidence established by previous guesses. Rating sources are shown per guess.

## Catalog

The pool contains **3,259 unique anime**. Random selection uses real eligible media, with one question per difficulty for each category except Anidle. Previous-round titles are avoided when possible. The pool is finite, so titles can recur in later rounds.

| Content | Easy | Medium | Hard | Total |
|---|---:|---:|---:|---:|
| Anime with screenshots | 167 | 280 | 312 | 759 |
| Individual screenshots | 780 | 951 | 961 | 2,692 |
| Unique characters | 641 | 1,074 | 1,180 | 2,895 |
| Anime with openings | 163 | 281 | 323 | 767 |
| Anime with endings | 164 | 242 | 258 | 664 |
| Anidle candidates | 184 | 649 | 2,259 | 3,092 |

Counts are recorded in `data/pool-report.json`. The library supports search, category filters, and 60-item pages. It deliberately reveals answers. The larger catalog is not a literal 1,000-fold expansion; entries are not duplicated to inflate counts.

## Protected hint media

**GitHub Pages / static hosting:** there is no Python backend, so `assets/blur-media.js` blurs video and cover clues in the browser. Frames are drawn into a 48 px canvas (covers 14 px) and upscaled, so the visible canvas never contains sharp pixels; the opening clue is locked to its 35–65 % window in the player. The original media URL is still reachable for a determined user, just like the answers in `data/pool.json`. The local Python server below remains available with its ffmpeg pipeline.


Hint images and videos are **processed into separate files by the local Python server**. Covers are downsampled, blurred, and re-encoded. Video blur is encoded into every frame. Removing CSS filters in Inspect does not restore sharp pixels.

Ending video hints contain the full blurred sequence, start at zero, and allow free seeking. Opening hints are physically trimmed to the permitted interval, defaulting to **35–65%** of the original duration. The editor can set explicit start and end seconds. The player displays the corresponding original timestamps; the downloaded hint file contains only that interval. **Audio remains complete and starts at zero.**

First-time hint generation takes longer than cached playback. Generated hints use a separate bounded 2 GiB cache. The server limits concurrent transformations to two and rejects arbitrary remote URLs and path traversal. Hint sources can be registered media, existing local media, or uploaded files. An unregistered custom HTTPS source can be used as normal media, but must be uploaded or added to the checked-in registry before generating hints. Failures offer a retry.

This is a local game, not an anti-cheat service: answers, source references, and scores remain in the browser-readable catalog/state. A determined user can inspect those or modify local code. The fix prevents CSS unblurring and removes out-of-window footage from the hint resource; competitive play would require server-side answers and scoring.

## Media loading and custom packs

Existing media lives in `assets/media/`. Additional registered media downloads on demand and requires internet on first use. The download cache defaults to 2 GiB; override it with `python3 server.py --cache-mb 1024`. Older files are evicted as needed. Static assets are outside that budget. HTTP byte ranges support playback and seeking. Hidden project/cache directories are not served as static files.

The media editor accepts uploads up to 25 MB per file, including complete opening/ending tracks. Custom packs are saved in IndexedDB and can be exported/imported as JSON. Activating or editing a pack archives current progress and starts fresh games. Progress lives in localStorage; another browser has a separate save.

Source attribution is recorded in `data/media-sources.json` and `data/media-index.json`. Public sources include AniGuessr, AnimeThemes, MyAnimeList, and AniList. External links may become unavailable; the complete remote library has not been downloaded or individually checked. Public availability does not grant rights for redistribution. AniLoop is not affiliated with those services.

## Interface

The interface uses black surfaces and muted mauve accents, clear hint states, separate answer panels, and searchable comboboxes with keyboard navigation. Use Up/Down to select a suggestion, Enter to accept, and Escape to dismiss. Dialogs, feedback, and editor controls share the same styling. Layouts support mobile widths and reduced motion. Fonts are loaded from Google Fonts with local fallbacks.

## Checks

```bash
node --test tests/core.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
ANILOOP_URL=http://localhost:8098 .tools/qa/bin/python tests/browser.py
ANILOOP_URL=http://localhost:8098 .tools/qa/bin/python tests/behaviors.py
ANILOOP_URL=http://localhost:8098 .tools/qa/bin/python tests/large_pool.py
ANILOOP_URL=http://localhost:8098 .tools/qa/bin/python tests/interface.py
ANILOOP_URL=http://localhost:8098 .tools/qa/bin/python tests/hint_failures.py
```

After changing any `.js` or `.css` file, run `node scripts/stamp_assets.mjs`. It gives every script and stylesheet a content hash in `index.html`/`admin.html` (plus an import map for nested imports), so browsers never mix old and new files after an update. `tests/asset_versions.test.js` fails when the stamps are stale. After a pool update, also run `node scripts/split_pool.mjs`.

Python media tests use actual ffmpeg output to check clipped durations, full-length opening hints, derivative cover files, and rejected sources. Browser checks require Playwright/Chromium; `.tools/qa` is the existing local QA environment. Screenshots are stored under `qa/`.

## Accounts, community leaderboards, and original branding

Open **Leaderboards** in the sidebar, or click **Guest player** to create an account. Finish all five categories of a default-pool round, then use **Submit to leaderboard** on the completed-round overview. Rankings show each player's best completed round, with Daily/Infinity and all-time/week/today filters. Account management includes sign-out and password-confirmed deletion. Usernames and submitted scores are public; game saves remain local to this browser.

The server stores accounts and rankings in `.runtime/community.sqlite3`. Passwords are hashed with scrypt; sessions use HttpOnly cookies. Restart the Python server to enable new account endpoints. Older saved rounds cannot be submitted because they lack per-question hint records; finish a new round. Leaderboards are community rankings and do not provide competitive anti-cheat guarantees.

Original SVG branding is available as `assets/mark.svg` (icon/favicon) and `assets/logo.svg` (wordmark). The frame/loop symbol matches the black and muted mauve interface.

For GitHub, run `python3 scripts/prepare_release.py`. It creates `.release/AniLoop/`, a small upload folder without bundled anime media, credentials, databases, or caches. See [DEPLOYMENT.md](DEPLOYMENT.md) for the backend/Docker setup. GitHub Pages alone cannot run the full app. No GitHub upload or public deployment is performed automatically.

## Party rooms, Co-op Infinity, and daily rewards

**Party rooms** gives up to eight signed-in players the same server-selected questions. Players answer independently; the host advances after everyone finishes. **Co-op Infinity** shares one answer state, score, and a budget of **eight hints across all five categories**. Complete the full 13-question loop before the host starts another. The shared budget applies to purchased screenshot/video clues; Anidle clues still unlock through guesses and skips. Used hints reduce points normally; reopening an unlocked clue is free. Room results remain separate from solo leaderboards.

Open **Party rooms**, create a room, and share the six-character code or invite link. Everyone must reach the same running server. Join before the game starts. Rooms persist in SQLite, refresh every 1.5 seconds, and can be resumed by signing back into the same account. The host can remove a disconnected player; leaving transfers hosting to the next member. Rooms expire after 24 hours without game activity. For friends on other computers, use your hosted site; a localhost invite only works on your own machine.

**Daily rewards** shows your current/best streak, a rolling seven-day activity record, badges at 3/7/14/30 consecutive claimed days, and a shortcut to Appearance. Finish all five daily categories in the default pool and claim **100 Loop Shards**. Every seventh consecutive claim earns **50 extra**. Rewards reset at **00:00 UTC**, while the existing quiz itself still rotates at local midnight. You can claim each quiz date only once and receive at most one reward per UTC day. A missed reward day resets the current streak, but keeps badges and the best streak.

Open **Appearance → Frames** to preview, unlock, and equip profile frames. Prices vary by design, from 250 shards for Silver lining to 10,000 for Galaxy loop. Previously purchased cosmetics remain owned when prices change. Filter **My collection** to see owned frames. Purchases equip the frame immediately; owned frames and Classic can be switched freely. Shards have no monetary value and cannot buy points or gameplay advantages. Rewards, inventory, rooms, and currency use the account database and survive server restarts.

## Themes and personal backgrounds

Use the prominent **Themes & backgrounds** button below the AniLoop logo to open the theme chooser directly, or open **Appearance → Themes** for Midnight mauve (the default), Moonstone, Forest night, or Ink blue. All four retain dark surfaces and subdued accents. Themes and backgrounds are free and work without an account.

**Backgrounds** offers Pure black, Mauve dusk, Night garden, and Midnight grid, plus a personal PNG/JPEG/WebP image up to 8 MB and 24 million pixels. Images are re-encoded to WebP and resized to at most 1,600 pixels on the longest side. Choose dimming, image position, and whether backgrounds appear during quiz questions (off by default).

Appearance preferences use `aniloop-appearance-v1` in localStorage. The uploaded image stays in the separate `aniloop-appearance` IndexedDB database; it is never sent to the server, placed in the account database, or bundled for GitHub. Themes/uploads apply only in this browser and origin; owned frames follow your account. Clearing browser storage removes local appearance preferences and images. **Reset theme & background** restores black/mauve while retaining the uploaded image and account frames; **Remove upload** deletes only the cosmetic background. Existing game saves and custom quiz media use their original, separate storage.

Appearance browser checks (against a disposable server):

```bash
ANILOOP_URL=http://localhost:8100 ANILOOP_TEST_DB=/tmp/aniloop-appearance-qa.sqlite3 .tools/qa/bin/python tests/appearance_account_browser.py
```

Social browser regression (use a disposable `ANILOOP_DB`):

```bash
ANILOOP_URL=http://localhost:8100 .tools/qa/bin/python tests/social_browser.py
```

Solo, Party and Co-op share these media rules. Giving up immediately submits zero points without a confirmation dialog (in Co-op, for the whole team). Character suggestions show names only. Anime displays use the English alternative title first and the Japanese catalog title below; titles without a translated catalog entry retain their available title. Accepted aliases remain valid.

Video hints begin preparing in the background while the current question’s audio is available. Unlocking still costs the same points and only then displays the hint. In-flight requests and cached derivatives are shared across player elements. Blurred hints use 320-pixel, 20-fps encoding to reduce preparation time and bandwidth; uncached downloads still depend on the registered source host.

Performance: JSON, JavaScript, CSS, HTML and SVG responses use gzip with ETag revalidation. Successful registered media and protected hints use immutable browser caching; API/account responses remain uncached. Catalog lookup, statistics and normalized search terms are indexed once per pack. Fonts are bundled locally (licenses in assets/fonts), with no external font stylesheet dependency. Startup renders the quiz before account/reward loading finishes.

Catalog additions are recorded in `data/catalog-update.json`. The 30 AniList additions provide real Anidle clues and covers; they do not claim screenshot or music availability. The public archive refresh adds five further catalog titles plus real question media. Existing pack identity and IDs remain stable. To reproduce updates: `python3 -m scripts.update_catalog --days 30`, then `python3 -m scripts.add_anilist --limit 30`. These commands append content and do not touch accounts or local custom packs.

## Friends and daily comparisons

Open **Friends**, enter another player's exact username, and send a request. The recipient can accept or decline; senders can cancel pending requests and either player can remove an accepted friendship. Both accounts must use the same AniLoop server. Use Refresh to get new requests and recently submitted results.

The Friends view compares selected-date daily totals, category scores, the seven daily quizzes ending on that date, and each player's best submitted Infinity round and round count. It includes your own result. Complete the default daily quiz and select **Submit to leaderboard** on Overview to share the result. Missing results are labeled **Not submitted**, including unshared or unfinished local games; a submitted zero-point result is still shown as zero. Local saves, custom packs, and Party/Co-op scores are separate. Dates refer to the quiz date, which resets at local midnight. No answers or quiz spoilers are exposed by this view.

Friend requests and friendships persist in the existing SQLite database and are removed when an account is deleted. API routes require authentication and mutations use the existing same-origin checks. Only accepted friends appear in a player's friends comparison; pending requests do not grant membership.

## Statistics

Statistics includes recorded active days, current and best solo-play streaks, highest completed daily score with its date, and a category score-history chart. Switch between Daily and Infinity; filter 7 days, 1 month, 3 months, or all recorded history. Category lines and range averages have separate toggles. Focus a chart date and use arrow keys to inspect scores, or expand the data table. Gaps are dashed and missing breakdowns are not invented. Infinity uses the best complete round per day, including that same round's category breakdown.

Detailed snapshots are retained for up to 1,000 played rounds, separate from the existing 100-row archive. New answers record local activity dates. Existing saves and total-only archives remain valid; older activity dates use the saved round date. These are device-local solo statistics, not synchronized account/Party statistics or reward-claim streaks. No sample data is added to user saves.

For the prepared localhost-only container and the limits of cost/legal guarantees, read [PRIVATE_DEPLOYMENT.md](PRIVATE_DEPLOYMENT.md). No paid hosting resource has been created. GitHub Actions is currently disabled in repository settings; local verification is documented below, and Actions must be enabled to run the Supabase deploy workflow.


## Bug reports

Choose **Report a bug** in the sidebar. Guests and signed-in players can describe the issue, reproduction steps, expected behavior, and actual behavior. Optional diagnostics show exactly what will be included: browser agent, viewport, theme/background IDs, originating app view, and app version. Account information, quiz answers, saves, custom images and console logs are not attached. Avoid personal information in free text.

**Send bug report** saves to this server's `bug_reports` table in the existing `.runtime/community.sqlite3` (or `ANILOOP_DB`). The server returns a `BUG-…` reference; it does not email anyone or create a GitHub issue. There is no public report-reading API. The server owner can review the table with a local SQLite client. **Download copy** creates a JSON file, including when submission fails. Drafts survive in-app navigation for the current tab session, but not page reloads.

Same-origin JSON requests only; maximum field lengths are validated on the server, diagnostic keys are allowlisted, and reports are limited to 15 attempts per client per 10 minutes and 1,000 saved reports. If the inbox is full, the page offers a download instead. Reports do not store the sender's IP or account ID. The owner controls local retention and can delete handled rows using a SQLite client. Restart the server after updating to enable `/api/bugs`.


## Public launch status and privacy (2026-11-23)

The Pages version is a static client with Supabase as its backend. Publication of the repository does not certify legal notices or grant rights to external media; review the draft status and checklist in [PUBLIC_LAUNCH.md](PUBLIC_LAUNCH.md) before inviting users. Pages excludes bundled anime media and protected video derivatives.

Footer links open **Privacy policy**, **Cookies & storage**, **Terms of use**, and **Legal & contact**, including direct `/#privacy`, `/#cookies`, `/#terms`, and `/#legal` links. Registration also links the policies. Contact: **dailyaniloop@gmail.com**. Notices are explicitly pre-launch drafts; the operator's legal identity and actual hosting arrangements remain unresolved (Vienna, Austria is confirmed). Local registration collects no email; enabled Supabase accounts use email/password and provider email confirmation. Password recovery and marketing email are not implemented. Optional bug diagnostics now default to off.

Signed-in users can open **Manage account → Download my account data** for authenticated JSON export. Password hashes, session tokens, and other players’ individual room progress are excluded. Account deletion additionally removes the account's individual state from serialized rooms; browser-only saves and custom media stay unchanged. Existing linked account data still follows its original deletion cascades. HTTPS public origins now imply Secure cookies; server responses add CSP, no-referrer and denied camera/microphone/geolocation permissions.

Hint cache version **opening-window-v4-light** uses a lighter burned-in video blur (`boxblur=3:2`, previously `6:3`) and a less heavily pixelated cover (48px intermediate, previously24px). Videos remain320px/20fps with protected Opening35–65% / full seekable Ending; both audios stay complete. Older strong-blur cache entries are not reused. Refresh the browser after restarting the server.


## Privacy acknowledgement and cookie choices

A first-visit screen appears before game-state/custom-media reads, pool/media fetches, or account API requests. Read the linked policies and acknowledge receipt of the privacy notice, then choose **Accept all**, **Only necessary**, or **Decline**. Decline rejects optional cookies, not storage required for requested features. All three buttons have equal visual weight and allow play; all currently enable **zero optional purposes**, because no advertising/analytics/tracking is installed. Acknowledgement is not blanket processing consent or a waiver of rights.

The `aniloop-privacy-v1` localStorage record contains notice/choice versions, acknowledgement, choice, timestamp, and an empty optional-purpose list. It expires after180 days or a version change. **Cookie settings** in the footer reopens it for an equally easy change. Future optional technologies require their own accurate purposes and new prior choices; an old Accept all never authorises future trackers. Existing quiz/media storage is untouched. Policy pages remain accessible before acknowledgement. This is a pre-launch implementation, not legal clearance.

## Extra scene variants

Screenshot questions already choose three different scene indices at random from each anime's image pool and retain them through reloads. Added **14 verified screenshots across8 existing anime** on2026-11-23. Library cards now show the available scene count. New scenes are appended, preserving old indices, anime IDs and pack identity so current saves are not reset. Updates include Maid Sama!, Keijo!!!!!!!!, KamiErabi GOD.app, Mushoku Tensei, Orange, Spy x Family, The Misfit of Demon King Academy, and Vinland Saga. Images were fetched and decoded to verify dimensions/content; provenance and hashes are in `data/scene-update.json`. Availability does not establish public-use rights; publication remains blocked.

`python3 scripts/add_scene_variants.py --days 60 --limit 120` checks recent source quizzes for alternate scenes of existing playable titles, deduplicates frame identities, and verifies images before appending. It never invents frames or changes custom media/accounts.


## Game-picker layout

The interface now uses a compact top bar and a centered game picker inspired by the layout of creatdle.dev. Five image-backed category cards and a personal-media entry lead into the original quiz. A compact round summary keeps progress visible; friends/party shortcuts and daily rewards remain below. Themes and account access stay visible on phones; the category switcher appears during quiz play. Library, editor, statistics, privacy and bug-report pages keep their existing functionality. The default remains black with muted mauve; alternate palettes and custom backgrounds still apply.

This is a visual reference only: AniLoop retains its own branding/code/assets, game rules and truthful pre-launch policies. No operator identity, hosting-provider claims or legal clearance were copied from the reference. The required privacy acknowledgement and cookie choices remain unchanged. No publication or GitHub push was performed.


## Browser navigation

Top-bar pages, quiz category/mode and Help now create real browser history entries using URL hashes. Back/Forward restores the screen and mode without undoing answers, scores or saves. Reloading a link such as `/#game/opening?mode=daily` returns to that category. Repeated clicks on the same route do not add duplicate entries. Existing `/#privacy` links still work. Help supports Back/Forward and Escape; closing a directly opened Help link returns home. The first Back from the initial AniLoop entry can leave the site normally.


## Austria project status and retention

AniLoop is a **personal project in Austria**, contact **dailyaniloop@gmail.com**. The legal operator name and any required public postal details remain outstanding. Privacy complaints can be directed to the Austrian Datenschutzbehörde; this does not claim the project has been approved by that authority.

`retention.py` cleans expired sessions,24-hour inactive rooms and90-day bug reports on server startup and hourly. It never expires existing accounts, scores, inventory, local saves or custom media. Account database connections enable SQLite secure deletion for future deleted records, and the account database is restricted to mode0600 when maintenance starts. Optional status/timestamp-only logs retain7 days; optional daily managed backups retain30 days and use mode0600. Both are off by default for local development; the private compose file enables managed backups only. Only conventionally named files in the dedicated `privacy-managed` subtree are rotated—old manual backups and symlinks are untouched.

A local privacy-request CLI tracks calendar-month response deadlines, a72-hour incident-assessment deadline, and minimal closed-case records for365 days; the internal reference is cleared after30 days. See [PRIVACY_OPERATIONS.md](PRIVACY_OPERATIONS.md) for commands, email handling, identity checks, mailbox security, request outcomes and deletion reconciliation before backup restores. These are operational procedures, not automatic Gmail settings or certification.

**Supabase Auth/PostgreSQL is the backend for the static Pages build.** The Python/Docker deployment remains available separately. Existing browser saves are retained locally; cloud save sync is opt-in to a signed-in account and does not migrate or delete existing local saves. Cloud deployment requires applying the additive SQL migration and deploying the Edge Function.

Prepared single-server HTTPS deployment: [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) and `compose.production.yml` keep the full application on one origin with persistent SQLite and a Caddy TLS proxy. Default ports bind only to loopback. No public host is configured and PUBLIC_LAUNCH.md still blocks publication.

AniLoop now uses an18+ self-declaration before quiz loading and account registration. This is not verified age assurance. The metadata-only content audit is in data/content-review.json; it does not classify individual frames. Private verification status and remaining external checks: [SECURITY_VERIFICATION.md](SECURITY_VERIFICATION.md).

## Clean GitHub upload build

Run `npm run build:pages -- /tmp/aniloop-pages` with Node.js 20 or newer. It creates a standalone static site with `index.html`, the Supabase browser client, registered media URLs and no Python runtime. Local media, accounts, saves, caches and service keys are excluded. Copy the generated files to the root of the Pages branch, including `.nojekyll`; the build refuses to overwrite an existing output folder. `npm run build` runs this same Pages build. The older `python3 scripts/prepare_release.py` command remains for the Python/Docker source package.

The static site uses Supabase Auth, PostgreSQL and the `aniloop` Edge Function for accounts, saves, leaderboards, friends, rewards, rooms and bug reports. First apply `supabase/cloud_runtime.sql` after the existing setup and account-actions migrations; then deploy the Edge Function and configure the public origin in Supabase Auth. Exact steps and current limitations are in [DEPLOYMENT.md](DEPLOYMENT.md) and [supabase/README.md](supabase/README.md). Protected opening/ending video hints are unavailable in Pages until licensed, preprocessed derivatives are configured in Storage; original video is never exposed as a hint.

## Supabase accounts

For local browser testing, build the Pages output and serve it from `http://localhost:8098` (for example, `python3 -m http.server 8098 --directory /tmp/aniloop-pages`). Python is only a convenient local static-file server, not an app runtime requirement. Production uses `https://ohemida.github.io/AniLoop/`. The browser contains only Supabase's publishable key. Passwords and session tokens go directly to Supabase Auth; privileged database access stays in the Edge Function. See [supabase/README.md](supabase/README.md) for migrations, deployment secrets and redirects.

## Profile backgrounds and titles

In **Appearance → Backgrounds**, upload a custom background and drag or resize the crop box to position it on your profile preview. This does not change the page background position. The original image stays on the device; the crop settings follow the account. **Rookie Looper** is the free default title. Equipping another title replaces it, and it can be equipped again for free.
