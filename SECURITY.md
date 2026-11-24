# Security and deployment notes

Do not commit `.runtime/`, `.tools/`, `.env`, SQLite databases, or browser test exports. `.gitignore` excludes these, and the release script uses an explicit allowlist. The HTTP server serves application files rather than the entire project tree; backend code, hidden directories, databases, and directory listings are not public routes.

Use HTTPS, Secure session cookies, an exact `ANILOOP_PUBLIC_ORIGIN`, persistent private storage, and edge rate/body/resource limits before exposing accounts publicly. Keep one SQLite-backed instance. Never publish a local database as a GitHub artifact. No real accounts are included in the upload folder.

Passwords use scrypt and sessions use hashed random tokens. Design references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Local game data is inspectable. Community score recalculation is not anti-cheat protection. Do not attach prizes or claim competitive integrity without a server-authoritative game mode and an independent review.

If reporting a security issue, contact dailyaniloop@gmail.com privately; do not include passwords, cookies, databases, or user data in a public issue. The contact mailbox is for private reports, not an automated password-recovery service. The owner must secure it with a unique password and multifactor authentication; this has not been verified.


## Pre-launch status (2026-11-23)

Publication is explicitly blocked by the owner until the legal, privacy and hosting prerequisites are resolved. No public launch or repository visibility change is authorized before that. See PUBLIC_LAUNCH.md. Existing local accounts and browser saves must not be migrated or erased as part of a frontend deployment.

Server responses now include a restrictive script policy, no-referrer policy, nosniff, denied framing, and disabled camera/microphone/geolocation. HTTPS public origins automatically get Secure cookies. Account export is authenticated, no-store, and excludes password hashes/session tokens. Account deletion also scrubs individual player state from room JSON. Optional bug-report diagnostics default to off. These controls are not a security certification; production TLS/proxy configuration, host hardening, backup handling, recovery procedures and independent review remain open.


Retention operations now run at startup/hourly:90-day reports, expired sessions and24-hour rooms; existing accounts/scores/inventory are not expired. Opt-in minimal request logs expire after7 days, optional managed backups after30 days; old manual/provider copies are not silently erased. Account SQLite permissions are0600; connections enable secure_delete for future row removals. This is not whole-disk/SSD erasure or encrypted-at-rest storage. Review the operator-only CLI and backup deletion reconciliation in PRIVACY_OPERATIONS.md. The project is confirmed personal/in Austria; PostgreSQL is only a future target, not a configured production database. Identity/media rights/actual hosting verification still block public launch.
