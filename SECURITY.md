# Security and deployment notes

Do not commit `.runtime/`, `.tools/`, `.env`, SQLite databases, or browser test exports. `.gitignore` excludes these, and the release script uses an explicit allowlist. The HTTP server serves application files rather than the entire project tree; backend code, hidden directories, databases, and directory listings are not public routes.

Use HTTPS, Secure session cookies, an exact `ANILOOP_PUBLIC_ORIGIN`, persistent private storage, and edge rate/body/resource limits before exposing accounts publicly. Keep one SQLite-backed instance. Never publish a local database as a GitHub artifact. No real accounts are included in the upload folder.

Passwords use scrypt and sessions use hashed random tokens. Design references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Local game data is inspectable. Community score recalculation is not anti-cheat protection. Do not attach prizes or claim competitive integrity without a server-authoritative game mode and an independent review.

If reporting a security issue, contact the repository owner privately; do not include passwords, cookies, databases, or user data in a public issue. A project-specific disclosure contact should be added by the owner before launch.
