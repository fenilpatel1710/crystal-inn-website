# Crystal Inn staff admin — secure launch checklist

## Owner sign-in
Only **crystalinngessner@gmail.com** is accepted by the admin API after checking Cloudflare Access signed tokens. Sign-in uses an emailed one-time code, not a GitHub-stored password.

## Cloudflare Zero Trust setup
1. Open Cloudflare dashboard → Zero Trust.
2. Settings → Authentication → Login methods: enable One-time PIN.
3. Access controls → Applications → Add application → Self-hosted.
4. Protect both paths on crystalinnstay.com: /admin* (dashboard) and /api/admin/* (data APIs). If needed, create separate applications with the same exact email allow policy.
5. Create an Allow policy with Emails = crystalinngessner@gmail.com only. Do not use Everyone or Bypass.
6. Note the team domain (your-team.cloudflareaccess.com), plus the Application AUD tag for the application covering /api/admin/*.
7. Workers & Pages → crystal-inn-website → Settings → Variables and Secrets. Set CF_ACCESS_TEAM_DOMAIN to the team domain and CF_ACCESS_AUD to the API application AUD tag.
8. Deploy or save a new Worker version as needed. Visit https://crystalinnstay.com/admin to receive your email code.
9. Unauthenticated requests to /api/admin/reservations must return HTTP 401 or 403, including via workers.dev. Signed JWTs must match the configured AUD, issuer and sole email.

## Portal capabilities
Reservation list: 200 most recent stored requests with guest details, status and Lumen sync state (read-only).
Rates and availability: staff can add supported room types and set nightly USD rates, room allotments and stop-sell for chosen dates.
These settings are planning data in D1. They DO NOT auto-confirm rooms or sync into Lumen. No public guest-rate/availability API has been activated.

## D1 verification
After you save a test nightly setting, run in Cloudflare D1 Console:
SELECT room_type_id,stay_date,allotment,rate_cents,stop_sell FROM nightly_inventory ORDER BY stay_date DESC LIMIT 10;

Never place an admin password or OTP code into GitHub or website source.
