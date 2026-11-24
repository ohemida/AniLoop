# Public launch: technical status and remaining checks

The latest owner instruction requests a public GitHub Pages build and repository push. The static client and Supabase backend code are prepared for that deployment; the repository's existing Pages/Actions settings and live Supabase setup still require remote verification. Publishing code does not complete the outstanding privacy, legal, security, email-delivery or media-rights review below. Contact: dailyaniloop@gmail.com. No paid hosting was provisioned, and no messages were sent to the contact mailbox.

## Concrete work prepared

- In-app, linked Privacy, Cookies & storage, Terms of use, and Legal/contact pages, including links from registration. They are visibly marked pre-launch drafts rather than claiming legal clearance.
- No advertising, analytics, remote fonts, marketing or newsletter. Local registration remains username/password; enabled Supabase accounts collect email/password with provider email confirmation. Password recovery is not implemented. Bug-report diagnostics are opt-in/off by default.
- Existing scrypt password hashes, hashed expiring random sessions, HttpOnly/SameSite cookies, origin checks and throttling retained. HTTPS public origins imply Secure cookies. CSP, no-referrer, frame/object restrictions and denied sensor permissions added.
- Authenticated server account-data export excludes credentials and other players' individual progress. Account deletion removes linked rows and individual room-state references; local progress/media remains. Anonymous reports can be handled by their reference.
- Browser storage inventory and controls documented. Login cookies and requested game/preferences storage are distinguished from optional tracking. An acknowledgement checkbox is explicitly not blanket processing consent. Equally prominent Accept all / Only necessary / Decline choices currently enable zero optional purposes. No existing Accept all authorises future trackers.

## Still unresolved for public operation and promotion

1. **Controller/operator identity:** personal project in Vienna, Austria and the public operator alias Insider are now confirmed, and the Austrian DSB is identified. The legal operator name, any required public postal details and the applicable national/children requirements remain outstanding. No identity/address is copied from Creatdle.
2. **Media rights:** verify public-use licences/permissions for all anime screenshots, portraits, covers and full music/videos, or replace the pool with cleared material. Attribution and blur do not provide permission. Existing rights are unverified.
3. **Hosting architecture:** the Pages client now targets Supabase Auth/PostgreSQL and an Edge Function. The additive `cloud_runtime.sql` still must be run in the live project and the Edge Function deployed. Python/SQLite remains an optional separate deployment. Protected video hints remain disabled on Pages. No paid hosting resource was created.
4. **Data-protection record:** final purposes/legal bases, processor agreements and subprocessors, locations/international-transfer safeguards, privacy-request process, correction/restriction process, adults-only access assessment, and reviewed final notices. Do not use a general “I accept privacy” checkbox as consent for all processing.
5. **Retention and operations:** implemented startup/hourly expiry,90-day reports, opt-in7-day minimal logs, optional30-day managed backups,365-day closed privacy-case records and an operator CLI. Accounts/scores/media are not expired automatically. PRIVACY_OPERATIONS.md defines request/deletion/incident/backup-reconciliation procedures. Production host/proxy/Gmail settings, mailbox MFA, access controls and a tested restore with deletion reconciliation still require deployment-specific verification.
6. **Production security:** HTTPS-only exact origin, secure proxy cookies and request limits, private backups, monitored access, bounded logs, secrets outside Git, mailbox ownership/MFA, and security review. If account email/verification/recovery is later requested, it needs configured mail delivery, token expiry/rate limits and reviewed anti-abuse behavior; it is not implemented by adding a contact email.
7. **Consent/third parties:** assess the actual deployed storage under national ePrivacy rules. Any future non-essential analytics/advertising/embeds must be gated before requests and allow equal refusal/withdrawal. GitHub Pages logs visitor IPs for security; don't claim a Pages site collects no personal data. Direct custom media links may contact external providers.
8. **Final check:** test the actual hosted architecture with test accounts and authorised media before public promotion. Local code changes cannot establish compliance or guarantee no costs, claims or fines. The repository and static page may be public at the owner's direction, but accounts will not function until the live SQL migration and function deploy are complete.

## Sources checked 2026-11-23

- [European Commission: GDPR principles, security and data minimisation](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [Your Europe: GDPR information and rights](https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm)
- [Your Europe: cookie rules and requested authentication services](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm)
- [EDPB: technically necessary cookies and consent](https://www.edpb.europa.eu/contact/frequently-asked-questions_en)
- [GitHub Pages: static hosting and visitor IP security logs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub: Pages cannot run server-side Python](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

These sources inform the implementation and open questions. They do not certify this deployment. The applicable national requirements depend on the operator and actual service.


## Details still needed from the operator

- Personal project in Vienna, Austria confirmed; still supply the legal operator name and required public postal details. Contact email is already supplied.
- Backend/hosting provider, processing locations, authorised access and relevant processor terms. A frontend-only Pages release cannot offer the current account/multiplayer service.
- Confirm the actual hosting/mailbox/proxy configuration follows the implemented retention and PRIVACY_OPERATIONS.md procedures. Existing accounts are preserved until deletion; no inactivity purge was added.
- 18+ audience chosen; verify the adequacy of adult-access controls and the handling of reported underage accounts, public media licences/permissions, and final review of the actual processing/legal bases.

The notice acknowledgement and cookie-choice implementation does not resolve any of these outstanding facts. No public publishing is authorised until the actual prerequisites are met.

## Hosting preparation and confirmed town (2026-11-23)

- Operator confirmed Vienna (Wien), Austria; no district or street address supplied. Public alias Insider retained. Legal identity remains unresolved, with no personal name inferred or published.
- Prepared compose.production.yml and deploy/Caddyfile: one same-origin Python/SQLite app with persistent account/cache volumes, HTTPS proxy, Secure sessions, 1 MB request cap, bounded timeouts/resources/logs and opt-in managed backups enabled in this deployment. Defaults bind only to loopback. See PRODUCTION_SETUP.md.
- No external host, public hostname, provider contract, region, mailbox access or intended account age has been supplied. These are not filled with assumed facts. Provider/mailbox configuration and final public notices remain pending. No public port/tunnel, Pages activation or paid resource created.
- AniGuessr's homepage and privacy policy were inspected. No evidence of media licensing was found in the pages reviewed; this does not establish whether the operator has private permissions or relies on a legal exception. Its policies do not grant AniLoop rights. Source: https://aniguessr.com/privacy-policy (checked 2026-11-23).

## Adult audience and private verification (2026-11-24)

- User selected 18+ if the library carries nudity risk. Metadata-only audit found 571 Nudity-tagged titles (132 with screenshots,113 with openings),251 Ecchi-tagged titles (36 with screenshots,40 with openings),0 Hentai-tagged titles. Counts overlap and describe anime-level catalog tags, not inspected pixels/frames. data/content-review.json and scripts/audit_content_metadata.py document the limited review; no family-safe or complete rating claim.
- The first-visit gate requires a separate18+ self-declaration before game/API/media loading; privacy acknowledgement/cookie refusal remain separate choices. Existing choice records must be renewed. Registration API requires literal adultConfirmed:true. No DOB/ID collection or verified age-assurance claim; existing accounts/saves/media remain intact.
- User declines public legal identity and says “let's hope”; this does not resolve operator identity or authorise publication. User's assertion that AniGuessr uses the same criteria does not supply evidence of media clearance. Both remain unresolved.
- No external server/hostname/SSH connection or suitable hosting-provider connector supplied. Docker rehearsal is private loopback only; no hosting purchase/account/provider terms invented. Gmail security cannot be verified from the contact address; owner must review https://myaccount.google.com/security-checkup and https://myaccount.google.com/signinoptions/two-step-verification while signed in. No email sent or settings changed.

## Supabase hybrid Auth integration (2026-11-24)

The original Supabase Auth adapter used Python with SQLite for game state; this remains available as an optional local/server deployment. No live Auth user/email was created by QA. Email delivery, project region/processor terms, SMTP/MFA/billing and final notices remain unverified.

## GitHub Pages + Supabase Edge (2026-11-24)

The static Pages client and Edge Function have now been implemented and locally tested. The public key is publishable-only. The additive `cloud_runtime.sql` migration has not yet been applied to the live project, and the Edge Function has not yet been deployed because GitHub Actions is disabled and no Supabase access token was supplied. The Pages build intentionally omits protected video derivatives. Existing local saves, accounts and custom media are not migrated or deleted. This release is a technical deployment, not evidence of legal clearance or confirmed media permissions.

## Owner override for temporary PC preview (2026-11-24)

After an explicit clarification, the owner answered yes to overriding the prior
publication hold for a temporary public PC-hosted preview. That preview now runs
through a Cloudflare Quick Tunnel; see PC_HOSTING.md for its address, controls,
verification and outstanding Supabase URL settings. This does not resolve the
requirements above or establish legal clearance. A later owner instruction
explicitly authorises pushing the source and publishing the static GitHub Pages
build; the earlier hold describes the pre-override state.
