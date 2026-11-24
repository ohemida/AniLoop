# AniLoop privacy operations

Personal project in Vienna, Austria. Public operator alias: Insider; town confirmed as Vienna (Wien); legal identity remains unconfirmed. Contact: dailyaniloop@gmail.com. These arrangements are selected by the operator's 2026-11-23 instruction to implement retention and privacy handling; the periods below are operational choices, not statutory periods prescribed for every website. Public launch remains blocked until identity, rights and real hosting arrangements are resolved.

## Enforced retention and preservation

| Data | Retention and enforcement |
| --- | --- |
| Accounts, submitted scores, friends, shards, owned frames | Kept while the account is maintained; self-service password-confirmed deletion remains available. No automatic inactivity purge of existing users. Review ongoing necessity annually. |
| Sessions | Expire after 30 days; expired records cleaned at startup/hourly and during sign-in. |
| Rooms | 24 hours without updates; expired room/member records cleaned at startup/hourly and during room operations. |
| Bug reports | 90 days from submission, capped at 1,000; startup/hourly and before accepting new reports. |
| Optional request logs | Off by default. If explicitly enabled: only timestamp/status, max1MiB per UTC day,7-day retention. No IP, URL, query, user agent, cookie, password or body is written by this logger. |
| Managed backups | Optional daily SQLite snapshots, one per UTC day,30-day retention; off by default for the development server, on in the prepared private compose configuration. Owner-only mode0600 files and0700 managed directories. Not claimed to be encrypted; use encrypted host storage before production. |
| Privacy cases | Minimal type/reference/date/deadline/status record, not email content;365 days after closure. Internal identity reference cleared30 days after closure. Open cases are not silently deleted when overdue. |
| Browser saves, media and appearance | Stay on the user's device until cleared by them; privacy/cookie choices expire after180 days or version changes. |

`retention.py` runs at startup and hourly while the server is running. It only deletes expired rows in the listed transient tables and conventionally named files in the dedicated `privacy-managed/<database-filename>/logs` and `privacy-managed/<database-filename>/backups` directories beside `ANILOOP_DB` (separate per database). It does not delete accounts/scores/media, arbitrary files, earlier manually made backups, files in `/tmp`, or symlink targets. Old manual backups and provider storage remain a separate operator responsibility. Account database permissions are set to0600. No external log collector is added.

Optional features: `ANILOOP_MANAGED_BACKUPS=1`, `ANILOOP_ACCESS_LOG=1`. No Gmail or hosting-provider settings are changed by these flags. Test backup restoration before production. Configure the host/proxy/provider to disable unnecessary access logging, or apply at most7-day retention to required security logs; identify actual provider behavior in the final notice rather than claiming this Python setting controls third parties.

## Handling requests through dailyaniloop@gmail.com

1. Check the mailbox regularly. Secure it with a unique password and MFA; this must be done/verified by its owner. No credentials should be shared in chat or committed to Git. Do not subscribe users to marketing.
2. Log the request using the local tool below, with a short internal reference. Normally respond without undue delay and within one calendar month. Complex cases can allow a further two months, but communicate the extension and reasons within the initial month. The tool does not automatically grant extensions or send replies.
3. Verify identity proportionately. Prefer an authenticated account and existing password-confirmed controls. Registration does not collect email, so receipt of an email alone cannot prove account ownership. Do not ask users to email passwords, session tokens or an unnecessary identity document. No email password-reset service exists.
4. Access/portability: direct the user to Manage account → Download my account data; also review any separately held support/operational records relevant to the request. Never include other players' individual data or credentials. Correction/restriction/objection: investigate the actual fields/purpose, restrict processing where appropriate, and document the outcome before replying.
5. Deletion: use the existing verified account deletion or a carefully reviewed local operation after verification. It removes live account-linked rows and individual room state while preserving the user's browser-only data. Anonymous bug reports require their BUG reference; locate/delete that report locally if appropriate. Do not promise to erase unidentifiable reports by username.
6. Close the case after responding. Keep support correspondence only90 days after resolution unless an identified legal obligation or active dispute requires a documented exception. This mailbox retention is a manual procedure, not a configured Gmail automation; clear Deleted/Trash as well. Retain only the minimal case record described above.
7. Isolated backups can retain deleted data until their30-day expiry. Before restoring, export the latest minimal deletion-request records to a separate secure location, restore to an isolated database, reapply verified deletions/restrictions using account identity/creation details (not numeric ID alone), run cleanup, and test before reconnecting. Do not overwrite the latest privacy records with stale restored ones. No restored backup may go live until reconciliation is complete.

## Local operator tool

This tool has no public HTTP endpoint and sends no email. It defaults to the existing local SQLite database. Use `--database /path/to/existing.sqlite3` for an isolated test or another explicitly chosen database. It refuses to create a missing database.

```bash
python3 scripts/privacy_admin.py open access case-2026-001
python3 scripts/privacy_admin.py list
python3 scripts/privacy_admin.py close PRIV-REFERENCE
python3 scripts/privacy_admin.py cleanup
python3 scripts/privacy_admin.py backup
```

Avoid passwords, full correspondence and unnecessary personal information in references. Keep the mapping/identity verification in the secured mailbox only as long as needed. The tool's account, room and transient cleanup must be tested against a disposable database before any restore procedure. Backup files are sensitive and are excluded from GitHub/release packages.

## Incidents and rights-holder enquiries

Record an incident immediately (`open incident case-reference` gives a72-hour assessment deadline, not a claim every incident must be reported). Contain it, preserve only necessary evidence in a restricted location, assess who/what is affected, and document the decision. Where GDPR notification is required, notify the Austrian DSB without undue delay and, where feasible, within72 hours of awareness; communicate with affected users without undue delay when the high-risk threshold applies. Delays and exceptions must be assessed, not automated by a generic policy checkbox.

For copyright enquiries, record the affected URL/work and the complainant's stated rights, restrict disputed material as appropriate and review the evidence. Public availability, blur or a “personal project” label does not establish a licence. Record clearance in a rights ledger before public launch; no permissions have been obtained automatically.

## PostgreSQL deployment decision

**PostgreSQL is the selected target database for a future public backend.** This is a target architecture decision, not an installed/migrated database. The running application and maintenance tool still use SQLite; neither MariaDB nor PostgreSQL can be connected by changing the filename or placing a database URL into `ANILOOP_DB`. Existing accounts remain intact.

The Python backend must run on an actual host with HTTPS, persistent storage and private database networking. GitHub Pages can serve the frontend but cannot execute the backend or ffmpeg. Before a PostgreSQL migration: implement/test the adapter and schema, preserve password hashes/account IDs/friendships/rooms/rewards, compare row counts, test sign-in/export/deletion/retention and rollback against a disposable copy, select an EEA region/provider and processor terms, configure least-privilege credentials/TLS/backups and review logging/transfers. No cloud resource, charge, database migration or public deployment was created here. PostgreSQL alone is not a hosting provider or a GDPR guarantee.

## Official references

- [Austrian DSB: complaints](https://dsb.gv.at/eingabe-an-die-dsb/beschwerde)
- [European Commission: handling rights requests](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en)
- [GDPR Articles5,12,17,32–34](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [EU copyright licensing and exceptions](https://europa.eu/youreurope/business/growing/protecting-intellectual-property/copyright/index_en.htm)
- [PostgreSQL backup/restore documentation](https://www.postgresql.org/docs/current/backup.html)

## Adults-only policy

The intended audience is18+. The browser stores an adult self-declaration with privacy choice/version/time for up to180 days. Account registration requires an explicit adult declaration; no date of birth or identity document is collected. This does not verify age or replace a review of the actual media and required access controls. Existing accounts are retained; reports of underage use must be reviewed and the affected account removed through the verified request process. A reported issue must not trigger deletion of an unrelated account based only on an unverified email.


## Persistent Supabase sessions

Supabase sessions now survive normal backend restarts. The game database stores
only the cookie hash and Fernet-encrypted provider credentials, expiring within
30 days of login. The private database-adjacent `.session-key` file stays in the
persistent runtime volume with mode0600; never add it to source, release folders,
logs, exports or images. Logout/expiry/account deletion remove durable records.
Restore needs the matching private key to resume sessions; without it, users
must sign in again. Never restore an old session database without reconciling
logout/deletion and expiry. Encryption does not protect against an operator or
attacker who can read both the key and database.

The privacy choice remains valid for180 days across wording-only notice edits.
Change CHOICE_VERSION when age/acknowledgement/optional-purpose requirements
change. An unrelated hostname cannot read another hostname's browser storage or
cookies. Do not promise cross-host sign-in or silent transfer of browser saves.
