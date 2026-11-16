# Private deployment without usage-based hosting

The prepared Compose file runs on your own computer and binds to **127.0.0.1:8110 only**. It does not create a cloud instance, buy a domain, add a payment method, or configure a public tunnel. Local electricity, storage, internet/data-plan costs, and any existing subscriptions still apply. There is no guarantee about unrelated account charges or future provider terms.

The setup is prepared, not deployed to an external service. Choose the host and private-access method before starting it. A localhost-only container is not yet a shareable deployment.

Generate a fresh sanitized release and run Compose **from that generated directory**, not from the full development workspace:

```bash
python3 scripts/prepare_release.py --output /a/fresh/release
cd /a/fresh/release
docker compose -f compose.private.yml config
docker compose -f compose.private.yml up --build -d
```

The new installation has its own accounts volume. It does not overwrite or automatically migrate the development database or browser saves. Back up SQLite with its backup API before any deliberate migration. Never copy the database into a repository or container image. Browser saves are tied to their origin; changing a URL does not move them.

To share across the internet privately, use an authenticated private VPN and restrict access to the invited people. Do not forward port 8110 on your router or switch its binding to 0.0.0.0. Tailscale Serve is one possible private HTTPS proxy: it exposes the app to the tailnet, not publicly. Tailscale Funnel is public and is not part of this setup. Tailscale's Personal plan currently states that it requires no billing details, but check your actual plan before use. No Tailscale account or network was created by this work.

Before proxying over HTTPS, set `ANILOOP_PUBLIC_ORIGIN` to the exact private HTTPS origin and `ANILOOP_SECURE_COOKIES=1`, then recreate the app container. Restrict the VPN ACL to the intended users. A private GitHub repository does not provide private website hosting.

The `accounts` and `cache` volumes persist across restarts. Do not use `docker compose down -v` if you need the accounts. The container has CPU/memory/process limits and bounded logs; existing media/hint caches have their own limits. These are local resource limits, not a legal or billing guarantee. The image pulls open-source dependencies from public registries, and the game fetches uncached registered media from external hosts.

## Rights and privacy limits

No blanket EU-law clearance or guarantee against fines, civil claims, or other costs is possible from a code review. The catalog contains third-party anime screenshots, covers, character pictures, and complete music/video tracks. Their redistribution licenses have **not** been verified. A public URL, blur filter, private repository, login page, or private VPN does not itself establish permission. Do not treat the prepared deployment as approval to redistribute that media. Use content you own or have permission to share, or obtain a qualified review of the actual sources, intended audience, and relevant national law before sharing the current library.

The app uses usernames/password hashes and session cookies; no external analytics or remote fonts are added. The GDPR has a personal/household exception, but whether a particular deployment falls within it depends on its facts. Private access alone is not a universal exemption. No claim of GDPR certification is made.

GitHub Actions has been disabled on ohemida/AniLoop to prevent future workflow runs from using billable hosted-runner minutes for this repository. Local tests remain available. This does not change billing settings for other repositories, stored artifacts, or unrelated services, and does not refund existing usage.

Sources checked on 2026-11-16:

- [Tailscale Serve: private tailnet access](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale Personal billing details](https://tailscale.com/docs/account/billing/modify-billing)
- [EU copyright guidance and limited exceptions](https://europa.eu/youreurope/business/growing/protecting-intellectual-property/copyright/index_en.htm)
- [European Commission: when data-protection rules apply](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en)
- [GitHub Actions repository controls](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
