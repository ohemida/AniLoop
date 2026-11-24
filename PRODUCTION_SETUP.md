# Single-server HTTPS setup (prepared, not publicly deployed)

This deployment keeps the website, accounts, friends, rooms and protected media on one HTTPS origin. It uses the existing SQLite backend with persistent storage, a Caddy TLS proxy and one app instance. PostgreSQL migration is not needed for this arrangement. GitHub remains source storage; GitHub Pages is not the application host.

## What is configured

- No app port exposed to the host; only the proxy receives requests.
- Secure, HttpOnly, SameSite session cookies, exact configured origin checks, existing authentication throttling and CSP.
- HTTPS certificates managed by Caddy for a real configured hostname. Host DNS and reachable ports 80/443 are required. No paid certificate service is provisioned.
- HTTP-to-HTTPS redirect; HSTS without preload or includeSubDomains.
- Proxy request-body limit 1 MB, bounded connection timeouts, container CPU/memory/process limits and bounded diagnostic logs.
- Proxy request/access logging disabled, application access logging disabled. Proxy errors may still contain connection/request information; keep diagnostics restricted and review provider logs separately.
- Daily managed SQLite snapshots, 30-day retention; account volume persists across app restarts. Snapshots on the same server do not protect against host loss. Arrange encrypted off-host copies and apply the same retention and restore/deletion reconciliation process before launch.
- Dedicated named volumes for accounts, disposable caches and TLS state. Existing development accounts are not migrated or overwritten.

## Configure only after launch clearance

Use the sanitized upload folder, not the full workspace. Choose an existing server capable of Docker Compose, a public hostname, storage and outbound media processing. Record its provider, actual region, processor terms, subprocessors/transfer arrangements, host backup/log policies and administrative access in PUBLIC_LAUNCH.md. No provider has been contracted by this setup.

Set these environment variables in the host shell or a private env file (never commit it):

```text
ANILOOP_SITE=quiz.your-actual-domain.example
ANILOOP_BIND=0.0.0.0
```

The site value is the hostname only, with no scheme, path or trailing slash. The example is not a real configured domain. IPv6 exposure and DNS must be reviewed separately. Default binding remains loopback until explicitly changed.

After all requirements in PUBLIC_LAUNCH.md have been resolved:

```bash
docker compose -f compose.production.yml config --quiet
docker compose -f compose.production.yml up --build -d
```

Do not use `down -v` on a live installation. Never publish the database, exported accounts, certificates or backups. Existing browser saves are origin-bound and will not automatically move from localhost. Deliberate account migration requires a private SQLite backup and a verified restore, not a copied repository.

## Local HTTPS rehearsal

Use a unique Compose project name and the following loopback-only settings. This requests Caddy's local certificate, not a publicly trusted certificate. Do not install the QA root certificate into your system trust store.

```text
ANILOOP_SITE=localhost:8443
ANILOOP_BIND=127.0.0.1
ANILOOP_HTTP_PORT=8086
ANILOOP_HTTPS_PORT=8443
ANILOOP_TLS_TARGET_PORT=8443
```

Browser QA may ignore certificate errors only for this isolated local test. Real hosted testing must validate the public certificate without such bypasses.

## Operator actions that software cannot complete here

- Secure dailyaniloop@gmail.com with a unique password and MFA, confirm recovery methods, review signed-in devices and monitor the mailbox. No Gmail settings were changed and no mail was sent.
- Audience is18+ with a required self-declaration before quiz loading and registration. No DOB/ID is collected. Verify that access controls suit the actual reviewed media and handle reported underage accounts before launch.
- Resolve operator identity and media rights. Vienna, Austria is confirmed; Insider remains an alias. Current notices stay drafts.
- Approve actual provider terms and settings; no billable resource or plan is created automatically.

## Hosted acceptance checks

On a controlled staging installation with disposable test accounts, run privacy/account export-deletion, two-player friends/Party/Co-op, and real audio/video browser regressions. Use authorised media. Verify Secure cookie flags, rejected cross-origin mutations, HTTPS redirection, media byte ranges, app restart persistence, snapshot integrity and restoration with latest deletion/restriction records reapplied. Never run registration/cleanup QA against the preserved development or real production account database.

The local rehearsal does not verify external DNS, public certificates, host firewall, provider controls or Gmail configuration. Public release remains blocked until those checks and the remaining legal facts are complete.

Sources: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Authentication currently limits by the direct connection IP. Behind this proxy, players share the proxy's limiter bucket; forwarded IP headers are deliberately not trusted. Before a wider launch, configure reviewed per-client abuse controls at the edge and test them with the actual traffic path. This setup does not add an unreviewed third-party Caddy plugin or claim provider-level rate limits are already configured.

## Rehearsal result (2026-11-24)

Loopback Docker HTTPS testing passed account registration/export/deletion and secure-cookie/origin/header/body checks; friends comparisons; full Solo real-media/editor/save regression; Party/Co-op real audio/video, sync/rejoin and daily rewards. Protected QA database table digests survived app restart, HTTPS health recovered, and a managed snapshot restored into an isolated temporary database with integrity_check=ok. The local test used a local certificate bypass restricted to localhost. This is not public hosted acceptance or a provider/mailbox audit. QA containers were stopped, without deleting persistent volumes.

## Full cloud hosting request (2026-11-24)

The owner now requests operation independent of their PC. Deploy the complete
Python/ffmpeg app plus persistent runtime (database, private session key, profile
pictures, backups) and disposable media cache on a backend-capable cloud host;
Supabase continues to provide Auth. This has not been done: no host account or
SSH/admin connection is available. The publishable Supabase key cannot provision
this host, install SQL or deploy privileged services. Do not publish index.html
alone or describe Supabase login as a full backend migration. Source/release
must exclude runtime data; transfer private data only over an authenticated
connection at cutover, verify accounts/roles/balances/pictures and restore before
replacing the PC instance. Browser-local saves/custom media remain on their
current origin; moving those into account cloud storage is additional work and
must preserve originals. No paid host or domain has been authorised.
