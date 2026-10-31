# Lumen PMS cookie-auth framework — Northwest 290 pilot (2026-10-31)

This is a **server-side authentication foundation**, not a live Lumen guest lookup or reservation connection. The existing Crystal Inn Next.js site and guest OTP authentication remain unchanged.

## Confirmed from the operator's developer-network observations

| Item | Observed |
|---|---|
| PMS origin | https://lumenpms.com |
| Login method | `POST` |
| Login endpoint | `/api/UserAccount/SignIn` |
| Request body | JSON with `emailID` and `password` |
| Successful response body | JSON boolean `true` |
| Web login cookie name | `AppCookies` (observed name casing varies; parsed case-insensitively) |
| Existing guest search | `GET /api/Guest/GetGuestByCodeOrIdentityNumberOrMobile` |
| Website hotel ID | `crystal-inn-northwest-290` |
| Northwest 290 PMS HotelID | `4` |

**Do not infer from `true` alone which Lumen database authenticated.** The operator reports separate login accounts and databases for each hotel. Lumen must independently demonstrate the session is scoped to Northwest 290's instance. `AppCookies` is an opaque auth cookie, **not** an API key to copy out of Chrome.

## Website implementation

- `lib/lumen/cookie-core.ts`: pure origin and cookie parsing/validation.
- `lib/lumen/cookie-auth.ts`: server-only, explicit Northwest 290 mapping. Requires `hotels.lumen_hotel_id = 4`, active property, exact approved HTTPS origin, developer-approved account. Calls SignIn with JSON, manually rejects redirects, checks body `true` and presence of an AppCookies session. **Discards cookie immediately after checking**; no global cache and no persistence.
- `app/api/hotel/lumen/connection/route.ts`: hotel-manager-only `GET` configuration summary and `POST` sign-in handshake test. Requires correct property-admin JWT/membership and D1-backed rate limit (3 requests / 15 minutes) using existing migration 0009. No secrets/cookies/upstream JSON leave the server. Disabled unless explicitly enabled by deployment configuration.
- `app/hotel-admin/page.tsx`: Lumen API panel, showing disabled/unconfigured status and an opt-in sign-in test control.
- `tests/lumen-cookie-core.test.mjs`: origin allowlist, login-true, cookie extraction, rejection behavior. Required by Cloudflare build check.

## Cloudflare secrets — do NOT add actual values to GitHub

Use Cloudflare Worker encrypted secrets (Dashboard → Workers & Pages → crystal-inn-website → Settings → Variables and Secrets). Set:

```text
LUMEN_NW290_BASE_URL=https://lumenpms.com
LUMEN_NW290_ALLOWED_HOST=lumenpms.com
LUMEN_NW290_SERVICE_EMAIL=<dedicated Lumen integration account email>
LUMEN_NW290_SERVICE_PASSWORD=<dedicated Lumen integration account password>
LUMEN_NW290_AUTH_TEST_ENABLED=false
```

`LUMEN_NW290_AUTH_TEST_ENABLED` must stay `false` until the Lumen developer approves and provisions a **least-privilege integration account**. For controlled staging test, set it to `true` and disable again afterward. Other hotels receive no outbound Lumen sign-in from this pilot; they require an independent registered configuration and credentials, never a guest-provided URL or username. A separate approved staging origin and corresponding allowed host can be configured later.

This module uses the Worker runtime bindings directly. No D1 migration is needed to add this authentication framework; it reuses existing `hotels` and `portal_guest_login_rate_limits` tables from earlier migrations, and the existing `GUEST_AUTH_PEPPER` secret for rate-limit key hashing.

## Test flow

1. Confirm Northwest 290 appears as active with `lumen_hotel_id = 4` in D1.
2. Developer creates a read-only integration account with its own credential, tied solely to the Northwest 290 Lumen database; ensure all prior exposed or shared credentials are revoked.
3. Developer confirms cookie name `AppCookies`, required auth headers, expiry behavior and exact instance binding; ensure login response is `true` plus a Set-Cookie header, with no cross-domain redirects. If the session cookie is chunked, the test explicitly fails; implement reviewed chunk support first.
4. Configure the five Worker values above; enable the test only in a controlled staging rollout.
5. Sign into `/hotel-admin` as Northwest 290 property manager. Open **Lumen API**, then **Test Lumen sign-in**. The result may say `authenticated_cookie_received`. That **does not verify database isolation**.
6. Independently confirm a hotel-identity/instance API endpoint using the same cookie, returning an immutable instance identifier and HotelID=4, and test that Northwest 290 credentials cannot access another property's instance or records. This identity endpoint is **not yet known** and is deliberately not invented in website code.
7. Keep all guest lookups and reservation writes OFF. Use a separate, reviewed authorization flow before enabling.

## Developer contract: what Lumen must deliver next

- Dedicated least-privilege, hotel-scoped integration login independent of employee sessions, with documented credential rotation, revocation, session TTL, antiforgery requirements (if any) and rate limits.
- **Signed-in identity endpoint** returning the actual authenticated PMS instance/database ID, hotel ID, and granted API scopes (without raw guest information). The website will compare those against a trusted server-side hotel mapping before **every approved data operation** or when obtaining a bound short-lived service token.
- Prefer a purpose-built, tenant-restricted bearer/client-credentials integration endpoint over staff-style cookie auth for production. Until then, any cookie must be server-only; it must never be sent to guest browsers, stored in D1, or shared across properties.
- An approved, sanitized guest service that excludes `identityNumber`, scanned ID photos (`frontSideImage`), government identification and payment data. The existing raw guest endpoint must **not** be proxied to public users.
- Read-only lookup for authorized hotel staff during ownership verification, a reviewed method to link `website hotel ID + portal guest ID` to `PMS instance ID + HotelID + GuestID`, and independently verified guest ownership. Phone OTP alone does not grant historic stay access.
- Test both positive isolation and **cross-hotel denial** under synthetic accounts, failed/expired cookie, rate-limit, guest privacy and rotation scenarios.

## Explicit release gates

- No guest-facing Lumen API routes or exposure of PMS records.
- No Lumen reservation write, inventory, or payment integration.
- Do not merge directly to production guest functionality merely because SignIn returns true.
- Never log or paste actual cookie values, integration passwords, license/identity numbers or ID images.
- Public repository may contain previous PMS archives/old credentials: perform Git history cleanup, revoke/rotate compromised keys, and review authorization bugs before production credentials are provisioned.

## Known limitations

`lib/lumen/server.ts` is an older OFF-by-default placeholder proposing an API key/UUID-based route; it is **not** the observed Lumen cookie endpoint, and is not used by this pilot. A production Lumen API adapter should replace/reconcile it only after Lumen's developer approves the complete contract.
