# Cloudflare deployment directly from GitHub (no PowerShell)

## Current stage
Cloudflare DNS for `crystalinnstay.com` is active. This existing GitHub repo holds the earlier Next.js prototype. A separate reservation-request Worker was packaged locally but **has not yet been pushed into GitHub or deployed**. The repository has also been reported to contain an exposed Lumen source archive; assess and remediate this before using it for guest operations. For the reservation Worker, prefer a **new private repository**; do not connect a potentially compromised public repository to production.

## Recommended dashboard-only steps
1. In GitHub, create a **private** repository named `crystal-inn-reservations`. Upload the extracted files from `crystal-inn-reservations-cloudflare.zip` using GitHub's **Add file → Upload files** control. The repository root should contain `wrangler.jsonc`, `package.json`, `src/`, `public/`, and `migrations/`. Do **not** upload passwords, `.dev.vars`, `.env`, API keys or guest data.
2. In Cloudflare Dashboard, create a D1 database called `crystal-reservations` under **Storage & databases → D1**. Copy its Database ID from Cloudflare. In GitHub's `wrangler.jsonc`, replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with that ID. (The ID is not a secret.)
3. In D1's dashboard **Console**, paste and execute the SQL from `migrations/0001_init.sql` for the production database. Review it before executing. Do not skip initialization.
4. In Cloudflare **Workers & Pages → Create application → GitHub**, authorize Cloudflare's GitHub app and choose `crystal-inn-reservations`. Confirm the Worker name matches the `name` in `wrangler.jsonc` (currently `crystal-inn-reservations`). Select `main` as production branch. Use root `/`, installation command `npm install`, and deployment command `npx wrangler deploy` (or Cloudflare's detected defaults), then Save and Deploy.
5. In Worker **Settings → Variables and Secrets**, create three **encrypted secrets**: `ADMIN_PASSWORD` (unique strong password), `SESSION_SECRET` (independent random >=32 characters), and `IP_HASH_SECRET` (different independent random >=32 characters). Never send passwords or secret values in ChatGPT or commit them. Redeploy if prompted.
6. Test on the `*.workers.dev` domain. Submit a synthetic reservation request; sign into `/admin`; verify it appears; test status updates. This app does not send booking writes to Lumen and does not guarantee a room.
7. In Worker **Settings → Domains & Routes → Add → Custom Domain** choose `reserve.crystalinnstay.com` and verify HTTPS. Do not edit the apex or `www` DNS records for this separate reservations Worker.
8. For optional staff email alerts, verify `crystalinnstay.com` in Resend; add `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL` as Cloudflare **secrets**, not GitHub files. Review DNS SPF/DKIM and existing email routing before updating records.

## After setup
On each GitHub push to `main`, Cloudflare Workers Builds will automatically rebuild and deploy. D1 schema migrations and secrets **do not automatically get created by merely connecting GitHub**. Keep a deployment checklist for future database changes.

## Live booking safety
Until the secure Lumen write integration is implemented and tested, the frontend must say **reservation request**, and staff must confirm availability, rate and booking. No guest-facing guarantee, no automatic SMS OTP, and no booking record in Lumen from this Worker.
