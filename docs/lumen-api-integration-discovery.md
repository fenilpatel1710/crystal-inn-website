# Lumen PMS ↔ Crystal Inn Guest Platform — Integration Discovery v1
Date: 2026-10-25
Status: Discovery only. No production API integration or guest authentication has been enabled.

## Observed facts
- Custom PMS: Lumen, built on .NET/C# and SQL Server, operated by an existing developer.
- Observed API origin: https://lumenpms.com
- Observed authenticated browser request: GET /api/UserAccount/GetSignInUserDetail
- Browser Network panel showed HTTP 200 and a Cookie request header.
- A cookie being present does **not** alone prove that it carries the auth session; the login endpoint, cookie issuance, authorization rules and CSRF mechanism remain unverified.
- This endpoint is **staff-specific** and must not be presented as a guest data API.


## Observed hotel-room endpoint (2026-10-25)
- Browser request: `GET https://lumenpms.com/api/Hotel/HotelRoom/GetHotelRooms/4`
- Browser response: HTTP 200.
- The trailing `4` is **unverified**; could be hotel/property ID or a different route parameter.
- Request's authentication and response JSON schema have not been verified. It must not be assumed to return date-specific sellable inventory or to be safe for anonymous public use.
- Next: inspect a **redacted sample response schema**, using placeholder values and no real room/access codes, guest names, contacts, tokens, cookies, or financial data. Confirm with PMS developer which endpoint provides availability for arbitrary check-in/check-out dates, and whether out-of-service rooms and confirmed reservations are accounted for.
- Before server integration: obtain developer-approved service-to-service credentials with hotel scope, not staff browser cookies.

## Security decisions (mandatory)
1. Do NOT commit staff passwords, browser session cookies, API keys, or guest data to GitHub.
2. Do NOT reuse or forward a staff browser's cookie from public guest JavaScript.
3. Request from the Lumen developer a documented service-to-service integration method, preferably OAuth2 client credentials or scoped API credentials. If only session login is supported, the developer must implement/approve a dedicated restricted service-account flow and explain cookie lifecycle/rotation, CSRF protection, and auditing.
4. Run integration exclusively server-side. Guest OTP auth and Lumen staff auth are independent.
5. Use TLS, secret storage, request timeouts, credential rotation, least privilege, audit logs, and a test environment with synthetic data.
6. Require per-property tenancy and per-guest authorization. A verified phone number must not automatically authorize access to every PMS record associated with it.

## Questions for the Lumen developer
- What is the official REST API base URL? Is https://lumenpms.com/api the stable documented base?
- Is /api/UserAccount/GetSignInUserDetail documented and suitable for service accounts?
- How is authentication accomplished: ASP.NET Core auth cookie, custom session, or mixed methods? What are login/logout/session-expiration flows?
- Are there API-only integration users, role scopes, hotel/property scopes, or client credentials?
- Which CSRF protections are required for POST/PATCH/DELETE?
- Is Swagger/OpenAPI available in a controlled internal environment? Provide sanitized OpenAPI specification or endpoint catalog.
- What are the authenticated endpoints for: property IDs, room types, availability, rate quotes, reservation holds, create/modify/cancel, guest lookup, stays, folios, posted payments, and event notifications?
- Does inventory locking happen in a transaction in the PMS? What is the concurrency and idempotency policy?
- Which endpoints are permitted for a guest platform and what guest fields are prohibited from export?
- Are there staging URL, integration testing credentials, IP allowlists, and rate limits?
- Is the PMS database directly accessed by approved internal code only? Prefer app-level APIs, not public DB access.

## Proposed Crystal Inn backend endpoints (NOT existing Lumen endpoints)
- GET /api/public/room-types
- POST /api/public/availability-search
- POST /api/guest/auth/otp/request
- POST /api/guest/auth/otp/verify
- GET /api/guest/me
- GET /api/guest/me/stays
- GET /api/guest/me/folios/{folioId}
- GET /api/guest/me/rewards
- POST /api/bookings/quote
- POST /api/bookings/hold
- POST /api/bookings/confirm

All guest-facing endpoints require input validation, property scope, access control, abuse protections, and audit rules appropriate to the operation. Booking/payment endpoints remain disabled until PMS inventory, payments, and cancellation semantics are verified.

## Proposed integration interfaces (implementation contract)
- ILumenAvailabilityClient: GetAvailabilityAsync(propertyId, checkIn, checkOut, roomTypeId, ct)
- ILumenReservationClient: QuoteAsync, HoldAsync, ConfirmAsync, ModifyAsync, CancelAsync
- ILumenGuestClient: SearchAuthorizedGuestAsync, GetStaysAsync, GetFolioAsync
- ILumenAuthenticationProvider: AcquireApprovedServiceSessionAsync, RenewOrReauthenticateAsync

Names above are conceptual .NET interfaces, **not** discovered PMS APIs.

## Stage 1 acceptance checks
1. Developer-approved staging API and auth specification delivered.
2. Backend connects under a dedicated restricted identity; no secrets reach browser or logs.
3. Health/status operation validates connectivity without returning staff personal data.
4. Read-only sample inventory response maps correctly to UI models.
5. Unauthorized guest request cannot retrieve another guest's stays or folios.
6. Expired/revoked integration credentials fail closed and trigger operations alert.

## Stage 2
Secure SMS OTP (provider-assisted, real server-side verification); guest identity linking; read-only guest history; reward ledger; real booking/payment integration after PMS transaction and authorization tests.
