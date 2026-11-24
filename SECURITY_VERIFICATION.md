# Private pre-publication verification — 2026-11-24

Nothing has been publicly deployed or pushed. No paid hosting resource, DNS record or tunnel was created. This record distinguishes checks performed here from unavailable external verification.

| Area | Result | Scope / remaining work |
| --- | --- | --- |
| Adult audience | Implemented, local tests passed | Separate18+ self-declaration before first game/media/API loading; registration rejects missing/false/non-boolean adult declarations. No DOB/ID collection. Not verified age assurance; direct media URLs are not protected by this browser gate. |
| Content inventory | Metadata reviewed |571 Nudity-tagged anime,132 with screenshots,113 with openings. Tags refer to anime, not classified frames. No complete visual review or claim of safe/unlawful content. See data/content-review.json. |
| Code regressions |62 Python and37 JavaScript tests passed | Includes API age-declaration rejection, consent versions and preserved game rules. |
| HTTPS proxy | Passed in loopback Docker rehearsal | Local Caddy certificate with QA-only localhost trust bypass. HTTP308 redirect, HSTS/CSP, no exposed app port, proxy body limit, Secure/HttpOnly/SameSite sessions and cross-origin rejection verified. No real domain/public certificate verified. |
| Registration and privacy | Passed in isolated TLS browsers | Adult/notice choices, no pre-confirmation pool/media/API requests, account creation/export/deletion, cookie settings, responsive layout and save preservation. |
| Solo playback/editor/saves | Passed in current isolated TLS browsers | Full real-media MP3/MP4 decode/play, clipped Opening/full Ending, editor/upload/import/export, responsive layouts and no JavaScript errors. |
| Friends | Passed in isolated TLS browsers | Two-player request lifecycle and submitted daily/Infinity results. |
| Original personal data | Preserved | Existing account/score/friend/cosmetic rows matched a private SQLite backup after the updated local server started. No QA accounts created in the real database. |
| Backups and multiplayer | Passed in earlier private rehearsal | Managed snapshot integrity/isolated restore and restart persistence; Party/Co-op real playback, sync/rejoin and daily rewards. Current change does not alter media or room logic. |
| External backend/provider | Not available | No existing external host, hostname or suitable authenticated hosting-provider connection supplied. Current selected architecture is single-server Docker/Caddy/SQLite. No provider contract, region, firewall or off-host backup settings are claimed configured. |
| Gmail MFA | Not inspected | The contact address is not access to Google security settings. No password, recovery,2SV or device settings were changed. Owner must check https://myaccount.google.com/security-checkup while signed in. Do not send passwords or recovery codes. |
| Publication clearance | Unresolved | Alias Insider and Vienna, Austria confirmed. Legal operator identity, media rights and review of actual hosting/access controls remain outstanding. The18+ rule and another quiz site's existence do not settle these facts. |

The regular local app is available at http://localhost:8098. This is private to the host computer and is not an internet share link. Browser saves retain their existing origin. The QA TLS containers are stopped after verification, retaining their separate volumes; no personal database was mounted into them.

## Supabase hybrid integration update

The app now uses configured Supabase Auth/profiles through the Python server; legacy local login remains separate. The publishable key is in supabase/project.json by design; no secret/service-role key is stored or exposed. Cloud JWT/refresh tokens are stored encrypted on this server behind an opaque HttpOnly cookie; no automatic JWT login from URL fragments. Signup uses PKCE confirmation followed by manual password login. Existing game data stays SQLite and both players need the same Python server. Backend restart preserves sessions with the existing private database/key; resumed identity is revalidated online. A database is bound to one project URL to prevent cross-project identity reuse.

75 Python tests and the additional email-return tests passed; mocked-provider browser tests cover confirmation/login/profile, current-account export/deletion, validated scores and mixed local/cloud Co-op. Local PostgreSQL17 tests verify owner-only export, recent-password deletion, anonymous denial and other-account preservation. Legacy local account/privacy/consent/performance regressions passed; mobile account actions now wrap. Live Supabase Auth settings were read successfully (email/confirmation enabled); no actual Auth user/email was created. Installing account_actions.sql and configuring exact local return URLs still requires the user's dashboard; real mailbox delivery/confirmed-user acceptance remains unverified. No public deployment.
