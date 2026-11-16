# AniLoop

English anime quiz with five categories, a daily challenge, complete music tracks, and Infinity rounds. Open this folder in IntelliJ IDEA, WebStorm, or Codex.

## Run locally

Requirements: Python 3, `curl`, `ffmpeg`, and `ffprobe` on your PATH. No npm installation is needed.

```bash
cd /home/insider/IdeaProjects/AniLoop
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

Maximum round score: **100,000**. Anidle unlocks its blurred cover at guess 13, synopsis at 18, and most popular character at 22. Its summary shows only evidence established by previous guesses. Rating sources are shown per guess.

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

Python media tests use actual ffmpeg output to check clipped durations, full-length opening hints, derivative cover files, and rejected sources. Browser checks require Playwright/Chromium; `.tools/qa` is the existing local QA environment. Screenshots are stored under `qa/`.

## Accounts, community leaderboards, and original branding

Open **Leaderboards** in the sidebar, or click **Guest player** to create an account. Finish all five categories of a default-pool round, then use **Submit to leaderboard** on the completed-round overview. Rankings show each player's best completed round, with Daily/Infinity and all-time/week/today filters. Account management includes sign-out and password-confirmed deletion. Usernames and submitted scores are public; game saves remain local to this browser.

The server stores accounts and rankings in `.runtime/community.sqlite3`. Passwords are hashed with scrypt; sessions use HttpOnly cookies. Restart the Python server to enable new account endpoints. Older saved rounds cannot be submitted because they lack per-question hint records; finish a new round. Leaderboards are community rankings and do not provide competitive anti-cheat guarantees.

Original SVG branding is available as `assets/mark.svg` (icon/favicon) and `assets/logo.svg` (wordmark). The frame/loop symbol matches the black and muted mauve interface.

For GitHub, run `python3 scripts/prepare_release.py`. It creates `.release/AniLoop/`, a small upload folder without bundled anime media, credentials, databases, or caches. See [DEPLOYMENT.md](DEPLOYMENT.md) for the backend/Docker setup. GitHub Pages alone cannot run the full app. No GitHub upload or public deployment is performed automatically.

## Party rooms, Co-op Infinity, and daily rewards

**Party rooms** gives up to eight signed-in players the same server-selected questions. Players answer independently; the host advances after everyone finishes. **Co-op Infinity** shares one answer state, score, and a budget of **eight hints across all five categories**. Complete the full 13-question loop before the host starts another. The shared budget applies to purchased screenshot/video clues; Anidle clues still unlock through guesses and skips. Used hints reduce points normally; reopening an unlocked clue is free. Room results remain separate from solo leaderboards.

Open **Party rooms**, create a room, and share the six-character code or invite link. Everyone must reach the same running server. Join before the game starts. Rooms persist in SQLite, refresh every 1.5 seconds, and can be resumed by signing back into the same account. The host can remove a disconnected player; leaving transfers hosting to the next member. Rooms expire after 24 hours without game activity. For friends on other computers, use your hosted site; a localhost invite only works on your own machine.

**Daily rewards** shows your current/best streak, a rolling seven-day activity record, badges at 3/7/14/30 consecutive claimed days, and a cosmetic frame shop. Finish all five daily categories in the default pool and claim **100 Loop Shards**. Every seventh consecutive claim earns **50 extra**. Rewards reset at **00:00 UTC**, while the existing quiz itself still rotates at local midnight. You can claim each quiz date only once and receive at most one reward per UTC day. A missed reward day resets the current streak, but keeps badges and the best streak.

Spend shards on **Silver lining (250)**, **Mauve orbit (500)**, or **Starlit loop (1,000)** profile frames. Purchases equip the frame immediately; owned frames and Classic can be switched freely. Shards have no monetary value and cannot buy points or gameplay advantages. Rewards, inventory, rooms, and currency use the account database and survive server restarts.

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

For the prepared localhost-only container and the limits of cost/legal guarantees, read [PRIVATE_DEPLOYMENT.md](PRIVATE_DEPLOYMENT.md). No cloud deployment or paid hosting resource has been created. GitHub Actions is disabled on this private repository to prevent future hosted workflow execution; run tests locally.
