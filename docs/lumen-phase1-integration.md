# Phase 1 — secure Crystal Inn ↔ Lumen integration foundation

Implemented in the Next.js website:
- Server-only transport at `lib/lumen/server.ts`, disabled by default.
- A read-only, sanitized response route at `GET /api/rooms/catalog`.
- HTTPS requirement, explicitly configured hostname, no redirects, timeout, server-side API key, no-store responses, and fail-closed behavior.
- Environment variables defined in `.env.example` — never put actual credentials in Git.
- The browser never gets Lumen staff passwords, staff cookies, or API keys.

**Current status: not connected.** The integration expects a dedicated endpoint:
`GET /api/public/v1/hotels/{hotelUniqueId}/room-types` with `X-Api-Key` auth.
This is a proposed endpoint, **NOT** an endpoint existing in the supplied CheckinPro feature_iteration11 code.

## Required changes in Lumen before activation
1. Fix critical staff authentication issues identified in `LumenPMS (CheckinPro) — Website Integration Brief.md`: reset-password OTP verification/expiration and exposure of sensitive endpoints; rotate leaked credentials.
2. Implement a separate service-to-service API key authentication scheme with server-side hotel scoping, without loosening existing staff cookie policies.
3. Allow only read-only sanitized room types for the integration key. No room numbers, guest information, staff details, or booking controls.
4. Create a restricted per-hotel API credential for Crystal Inn; transmit via approved secret channel. Never reuse browser `AppCookies`.
5. Deploy to staging first and test with synthetic hotel data. When endpoint and environment are verified, set `LUMEN_INTEGRATION_ENABLED=true` and server-side environment variables in Vercel.
6. Reconcile room inventory before enabling any public booking; bookings and payments are NOT enabled by Phase 1.

## Example expected response from dedicated endpoint (illustrative only)
```json
[
  {"roomTypeId":4,"name":"King Non Smoking","description":"","maxOccupancy":2}
]
```

## Verification criteria
- Without configuration, `/api/rooms/catalog` returns 503, not a sample or staff response.
- With an approved test endpoint and valid credentials, returns only `roomTypeId`, `name`, `description`, and `maxOccupancy`.
- Invalid credentials, unapproved hosts, unavailable upstream, and unexpected payloads fail without exposing secrets or internal PMS data.
- No live booking or guest account functionality is claimed or enabled.
