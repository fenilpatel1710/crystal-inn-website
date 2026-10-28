# Guest portal phase 2 — link existing Lumen guest first, show history second

## Product decision
Crystal Inn is the pilot property (Lumen HotelID 4). Do not modify Lumen or create room holds/bookings through Lumen. Online reservations are planned to be handled separately through a channel manager with manual room allotment.

Guest accounts **must reuse existing Lumen GuestCode** and the corresponding internal GuestID, not generate competing guest IDs or overwrite any PMS guest record. This does **not** make GuestCode an authentication credential.

## Implementation sequence (not yet deployed)

### A. Independent authenticated portal account
- Implement real server-validated SMS OTP, with rate limiting, expiry, attempts limit, replay protection, and session cookies (httpOnly, Secure, SameSite).
- Do not use the current frontend-only demo OTP (123456) for a real account.
- Store portal guest identity in a separate database, not in Lumen. No credential, guest document image, identity number or payment-card data goes in the browser or logs.

### B. Link request for an existing guest
- After OTP verification, allow the guest to request linking using their existing Lumen GuestCode.
- Treat the guest code and even a matching verified phone number as *insufficient* proof of ownership (numbers can be shared/reassigned; guest code might be printed on a receipt).
- Verify ownership with a safer additional factor **or** a front-desk review of the existing guest record, with minimal-data, redacted lookup. Do not reveal whether a guest code exists to anonymous users.
- If records are ambiguous, duplicated or conflicting, stop and require supervised reconciliation.
- The guest must receive notice before the link is approved.

### C. Link persistence (separate database)
Table `guest_account_link`:
- `id` UUID primary key
- `portal_user_id` UUID, foreign key to OTP-authenticated portal user
- `hotel_id` integer (4 for pilot)
- `lumen_guest_id` integer
- `lumen_guest_code` varchar (reference, not a secret/auth factor)
- `status` enum/policy: pending, verified, revoked
- `verification_method`, `verified_at`, `verified_by`, `created_at`, `revoked_at`
- unique active verified link on `(hotel_id, lumen_guest_id)` unless the business explicitly supports shared accounts
- Audit events for link creation, approval, denial, revocation and reads.

Guests can request changes; actual link approval must pass verification. No automatic account linking solely from telephone or GuestCode.

### D. Data feed and history
First launch should use **authorized periodic read-only imports** from Lumen into an isolated secure server-side database (e.g. staff-produced encrypted CSV export with an approved workflow). This avoids exposing the broad Lumen staff session to public guest requests and avoids modifying PMS source.
- Import only approved guest code/ID, basic profile fields, property-scoped completed stay records, and reward ledger as authorized by hotel owner.
- Keep guest profile and stay data private, encrypt at rest, set retention policy, and prevent raw export files from entering public Git.
- History endpoint must derive `portal_user_id` from its authenticated session, then query only **verified** links for that user and the specific hotel. Never accept guest code or guest ID from a browser as authorization.
- Show only that guest's allowed past stay dates, room type, status and earned points. Payment/receipt data requires a separate authorization and privacy review.
- Preserve immutable import source IDs and `last_synced_at`; display sync freshness. Never use imports to update Lumen.
- If an approved narrowly scoped live API is later provided by Lumen, swap the read-only source adapter without changing guest login or authorization.

### E. Security tests before real data
- One guest cannot see another guest's history by editing a GuestCode, guest ID, or URL.
- Duplicate GuestCodes or multiple phone matches do not auto-link.
- Reassigned phone number cannot take over an existing verified link.
- Unlinked user sees a neutral pending/unlinked state, never PMS data.
- Revocation immediately hides history.
- Error and audit logs contain no PII beyond minimal opaque identifiers.
- Demo OTP and fictional reward data cannot grant access to real APIs.

## Source information already documented
Feature Iteration 11 staff endpoints include:
- `GET /api/Guest/GetGuestByCodeOrIdentityNumberOrMobile` (query parameters)
- `GET /api/Guest/GetGuestByMobile`
- `GET /api/Guest/GetGuestById/{guestID}`
- `GET /api/Guest/GetGuestRewardPoint` (`hotelID`, `guestID`)
- `GET /api/HotelRoomBooking/SearchHotelRoomBooking` (search fields)

These are **staff APIs, not guest APIs**. Their documented presence does not grant permission to call them from public guest portal. Current broad staff authorizations and potential vulnerabilities must be addressed before live session-based integration.

## Delivery status and dependencies
- Phase 2 design: documented.
- Portal database / OTP service: not built.
- Guest linking workflow / staff approval UI: not built.
- Import connector / validated history feed: not built.
- Live guest data: not enabled.

## Next practical milestone
Build a real portal identity store + OTP and an authenticated link-request flow using synthetic test accounts. Then add authorized existing-guest mapping and a staff confirmation workflow. Only after verification and privacy tests, enable history retrieval.
