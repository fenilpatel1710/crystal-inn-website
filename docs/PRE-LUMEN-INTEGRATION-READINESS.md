# Crystal Inn: pre-Lumen go-live checklist and required developer handoff
Updated: 2026-10-31. This is an implementation contract, **not a claim that Lumen is connected.**

## What the website already has (source, subject to deployment verification)
- Cloudflare D1 hotel directory, hotel/property admin access, room types and manual starting rates, guest contact forms and stay requests.
- Super Admin controls, property photos stored privately in Cloudflare R2.
- Migration 0008 introduces a per-hotel photo library with reusable images, per-room 3-photo slots and a deliberate permanent-delete action that refuses deletion while in use.
- Migration 0009 creates guest portal identity/session tables. A guest sign-in page and Twilio Verify-backed OTP endpoints are present, disabled by default until the service is configured and tested.
- `lib/lumen/server.ts` is an OFF-by-default *proposed* room-type-only client. Its placeholder UUID hotel identifier is NOT the observed numeric Lumen HotelID 4. Adapt per property's actual identifiers and approved API contract before activation.

## Launch prerequisites owned by website operator
1. Back up production D1; run 0007 then 0008 for the media library; independently run 0009 for guest portal. Verify results and deploy corresponding code only after a staging test. The old image table is deliberately retained as a migration backup; after verification do not run the backfill again.
2. Confirm hotel address, amenities, actual room type names, image rights, room rates and inventory source, accessibility details, child and pet policies, terms, cancellation/deposit policy, and privacy/SMS consent language.
3. Replace any third-party image hotlinks with hotel-owned media where appropriate. Verify featured/photo fallback and mobile layout.
4. Configure `GUEST_OTP_ENABLED=true`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, and a random 32+ character `GUEST_AUTH_PEPPER` as encrypted Cloudflare Worker secrets. Obtain a Twilio Verify Service; enable fraud controls, test and monitor SMS cost/delivery. Never place credentials in GitHub or the browser. Guest OTP must be staged and test-passed before enabling. Unknown/missing configuration returns 503.
5. Verify D1 guest session cookie, hotel scoping, OTP request/check rate limits, expired OTP handling, sign-out, guest privacy, and guest-link approval. No default `123456` demo code remains in active navigation.
6. Consolidate/retire the legacy `/admin` portal only after migrating and reconciling its Northwest 290 operational records, permissions, and room inventory with `/hotel-admin`.
7. Validate request notifications, spam protection, manual booking approvals, staff audit logs, HTTPS, metadata, mobile accessibility, monitoring, backups, deletion and retention policies. Booking requests are not live Lumen bookings.
8. Secure exposed old PMS source: the public GitHub repository contains a Lumen feature-iteration ZIP and older documentation reports active-looking secrets and authorization bugs. Move sensitive archives into restricted storage, purge public Git history according to the provider's procedure, rotate/revoke keys, audit access, patch authorization and OTP vulnerabilities before any production Lumen connector is enabled.

## Required FROM the Lumen developer (NOT inferred from the browser endpoints)
Ask for a developer-approved **staging** REST/OpenAPI specification, the production base URL, server-to-server credentials scoped to one hotel, expiration/rotation, IP/network allowlist rules, test data, account authorization boundaries, and service owners/support contacts. Never reuse a staff browser cookie or expose the PMS to guest browser requests.

### 1. Property and room-type mapping
- Confirm Crystal Inn Northwest 290's PMS `HotelID=4` from the supplied sample. Confirm each individual property's **PMS database/instance ID**, HotelID and room type IDs; they are not globally unique across different PMS instances.
- Confirm room type IDs observed in the snapshot: 4 King Non Smoking, 5 King Smoking, 6 Queen Non Smoking. Supply full sanitized list and active/inactive mapping plus nightly occupancy and bookability.
- Explain why previous `GetHotelRooms/4` returned 35 rooms while physical property inventory was described as 57. That snapshot is **not** a date-based availability feed.
- Provide a read-only catalog and a **date-range** availability/rate-quote service that accounts for all confirmed and pending holds, out-of-service rooms, taxes/fees, minimum-stay rules, currency, timezone, deposits and stop-sell.

### 2. Direct reservations to Lumen (overnight stays)
Deliver safe, tenant-scoped server-to-server operations (new endpoints or hardened adapter) for:
- **Quote/availability**: hotel ID, room type, check-in, check-out, adults/children, available quantity, total and price breakdown, quote expiry; authoritative inventory checked with reservation writes.
- **Hold/create**: transactional inventory lock/availability recheck, idempotency key, website booking reference, approved guest profile mapping or safe new guest creation, accurate arrival/departure. Allow creating `Booked` with **HotelRoomID=null** so front desk can assign a room at arrival. Return stable `HotelRoomBookingID`, `BookingCode`, status and timestamps.
- **Search/status**: fetch current booking by website reference / PMS ID with safe hotel scoping, plus cancellation and no-show statuses for reconciliation after timeouts.
- **Cancel/modify**: authenticated and authorized, with cancellation reason, cutoff policy, applicable refunds, reconciliation, status update in PMS. Existing `RoomCancel/{hotelRoomBookingID}` is a staff operation, not permission to expose it publicly.
- **Sync**: signed webhooks or authenticated, bounded polling for status changes, race-safe retries, mapping between website ID and Lumen booking ID, two-way audit logs.
- **Front desk validation**: new unassigned bookings appear in **New Arrivals** on the correct date, can be assigned at check-in; cancelled bookings appear in **Cancelled**. No duplicate guest/reservation records, and simultaneous last-room bookings cannot oversell.

Known blockers from feature-iteration 11 review: reported `AddHotelRoomBooking` path may not recheck inventory atomically and may upsert guest records on null identity numbers. These MUST be fixed by the Lumen maintainer or isolated behind a safe, audited, approved adapter before enabling real booking writes.

### 3. Guest portal linking and stays
- **Website authentication**: Cloudflare issues a hotel-scoped guest account after independent **real SMS OTP**. Lumen does **not** authenticate the guest. Phone possession alone never grants access to a historic PMS guest record.
- **Private guest lookup for staff/approval**: scoped, sanitized GuestID/GuestCode lookup (not a public guest search); proof-of-ownership/staff approval workflow for matching an existing Lumen GuestID and GuestCode to the local portal ID. No automatic linking by phone number or GuestCode alone.
- **Read-only guest data APIs**: for the *verified* HotelID+GuestID, return minimal profile fields, current/future/historic stays, reservation state, folio summary where authorized, eligible points balance/ledger, and update timestamps. Clarify duplicate guest handling, consent, retention and payment data exclusion.
- **Security**: queries must derive GuestID from the server-side verified link, never accept a guest-selected GuestID/GuestCode as authority. All access per-property with audit logs and explicit link revocation. Reassigned phone and shared-phone tests must NOT reveal previous guest stays.
- Existing discovered staff routes include `GET /api/Guest/GetGuestById/{guestID}`, `GET /api/Guest/GetGuestRewardPoint`, and `GET /api/HotelRoomBooking/SearchHotelRoomBooking`. These are **not approved guest endpoints** and should be wrapped by the Lumen maintainer or replaced with restricted integration APIs.

### 4. Security and operational deliverables
- Sanitized OpenAPI/swagger or exact endpoint names plus request/response samples (no real guest identifiers).
- API-only integration client (no shared staff login), separate credentials for staging and production and each property.
- Authorization and rate limits, unique idempotency keys, conflict/error codes, inventory isolation, timezone, cancellation terms, audit hooks, credential rotation and webhook verification.
- A non-production sandbox with synthetic guests/bookings and access for end-to-end tests.
- Documented operational support, incidents/retries, reconciliation runbook and rollback.

## Release gate
Lumen mode must remain **OFF** until all of these pass: service auth+tenant isolation, safe room/catalog, date-scoped rate/inventory quote, successful transactionally safe unassigned booking, PMS New Arrivals/Cancelled parity, duplicate/timeout retry tests, independently verified guest link, private stays/points reads, and independent security review. Live reservation/payment confirmation must never be inferred from a website request or a single PMS network 200.
