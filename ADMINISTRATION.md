# AniLoop administration

The PC-hosted Docker database grants the existing exact `Insider` account read/write
administrator access and an initial grant of 1,000,000 cosmetic Loop Shards.
Normal cosmetic purchases reduce the balance; later updates preserve that spending.
The grant is tied to its numeric account ID. The existing `kitsune` account has no administrator permissions. No name-based automatic promotion,
Supabase dashboard permission, infinite balance or client-side privilege was added.

Refresh AniLoop after signing in, open **Your account → Admin dashboard**, or
visit `/admin.html` on the same origin. The dashboard shows server account
counts, the latest 100 usernames/balances and latest 100 bug reports. Administrators can set shard balances from 0 to 1,000,000,000 and permanently
delete bug reports; report contents are private. It excludes password hashes, email
addresses, session tokens and report diagnostic payloads.

`/api/admin` rechecks the authenticated numeric ID against the SQLite
`account_roles` table on every request. Only the local operator can grant roles
through database administration; there is no public promotion endpoint. Roles
cascade on account deletion, so recreating the same name does not inherit them.
Supabase metadata and browser flags cannot grant access.

The change was applied only to the active `aniloop-pc_accounts` Docker volume.
The development database and unused Supabase wallet scaffold remain unchanged.
A private pre-change SQLite backup is in that volume under `operator-backups`;
this manual backup is not covered by automatic managed-backup pruning.
Deleting a live account later requires reconciling any restored backup.


## Write access and profile pictures

`POST /api/admin/action` checks the current database role inside the write
transaction. Normal players, including kitsune, cannot change player balances
or read/delete reports. Role grants remain operator-only through database
administration; the web dashboard cannot grant roles. Admin access is for
AniLoop only, not Supabase project administration.

Signed-in players can manage their own picture under **Appearance → Profile
picture**. Client uploads accept PNG/JPEG/WebP up to 8 MB and 24 million pixels,
then crop to a 256×256 PNG. The server validates PNG structure, CRCs, bounded
pixel dimensions/decompression and filter bytes, strips ancillary metadata and
rejects remote URLs and SVG payloads. Only the owner can fetch their picture;
no public or other-user picture endpoint exists. Pictures are excluded from
leaderboards, friends and room views. This does not detect objectionable image
content; privacy of the picture prevents other players from seeing it.

Pictures persist in the game database across devices using the same account.
They are exported with their owner's account and cascade on account deletion.
Themes/backgrounds remain browser-local. Existing uploads/saves are not reset.
