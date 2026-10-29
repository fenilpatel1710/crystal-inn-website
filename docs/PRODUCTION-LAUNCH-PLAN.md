# Production Launch Plan — Crystal Inn Northwest 290
Updated: 2026-10-28

## Agreed architecture
- **Lumen PMS unchanged:** manages short stays, walk-ins, physical room assignment, housekeeping, folios and historical guest codes.
- **Channel management deferred:** do not implement Booking.com/Expedia or third-party channel manager until the hotel owner reauthorizes it. For now, local test reservations use manually allocated website inventory only. They are not confirmed live hotel stays.
- **Crystal Guest Portal:** Cloudflare Workers + D1 planned for website-only registration/authentication logs, verified phone sign-in, and mappings to existing Lumen GuestID + GuestCode. Lumen stays the source of truth for guest profiles, stay history, reward points and folios. Show Lumen data only after independent guest ownership verification and through a secure, approved server-side connector. New website registration stays pending until securely matched to a PMS record; never auto-create or overwrite Lumen guests without explicit authorized PMS workflow.
- **Front desk:** notifications and daily-arrivals board; staff manually record online reservations in Lumen.
- **Initial rollout:** one Crystal Inn property, not multi-hotel. Target hosting is Cloudflare Workers/D1/R2 rather than Vercel; existing Python/SQLite pilot must be ported before deployment. Avoid duplicating Lumen history and reward ledgers in D1 except narrowly scoped, transient cached data if needed.

## Milestones and definition of done

### Release 0: Trustworthy public brochure
- Replace third-party hotlinked photos with hotel-owned originals and confirm rights.
- Verify actual property details, amenities, room categories, phone/address, accessibility and policies.
- Separate booking CTA from demo; no misleading reservation confirmation.
- Privacy policy, terms, cancellation and data-use disclosure reviewed by business owner.
- Test desktop/mobile, forms, metadata, error states, accessibility and HTTPS.

### Release 1: Operational front desk
- Set up managed production database (suggest Postgres via a managed service).
- Core tables: properties, room_types, allotments, channel_bookings, booking_events, staff_users, audit_events, booking_entry_status.
- Restrict staff dashboard with server-side roles and strong authentication.
- New booking notification ingestion through signed provider webhook or authorized API polling; idempotent event handling.
- Arrival calendar: check-in date, guest-safe summarized display, OTA confirmation, room type, number of rooms, and 'Entered in Lumen' status.
- Manually allocated inventory tracked by date and room type; channel manager remains system of record for online sales.
- Webhook verification and retry/dead-letter/reconciliation jobs before relying on alerts.

### Deferred: Live direct reservations (not authorized for current phase)
- Select and contract an approved Booking.com + Expedia channel manager with partner API **or** embedded booking engine. Verify account-specific API permission to read date-based inventory, quote rates, create/cancel reservations and receive booking events.
- Keep all website booking requests server-side, use provider's live inventory/rates and idempotency; do not claim booking until provider confirms.
- Confirm one shared pool of allocated online inventory; manual allotment updates are reconciled to physical readiness in Lumen.
- Hosted PCI-compliant payment page/provider, if prepayments are required. Never collect raw card numbers in our own forms.
- Test two simultaneous last-room bookings, cancellation rollback, duplicate events, outages and dates/time zones.
- Do not call Lumen for any inventory block or booking write.

### Release 3: Real guest accounts
- Hosted SMS OTP or auth service with rate limits, retries, expiration and real sessions; remove current hardcoded '123456' demo.
- Guest portal user IDs and verified phone ownership stored separately from Lumen.
- Secure existing Lumen GuestID and GuestCode linking, with stronger proof or staff approval and audit trails. GuestCode is an identifier, **not** a password.
- Unlinked accounts cannot see real guest history or balances.

### Release 4: Existing guest history / rewards (Lumen primary source)
- Prefer a vetted, narrow, authorized **read-only server-side Lumen API** to fetch guest details, eligible historical stays, and rewards on demand; do not expose Lumen staff endpoints to guests.
- Website D1 stores only verified (portal_user_id, hotel_id, Lumen GuestID, Lumen GuestCode) mappings, onboarding status, and audit metadata, not the authoritative history or rewards ledger.
- If current Lumen API cannot securely authorize a guest-specific read, use a restricted encrypted export/reconciliation process temporarily or modify Lumen to provide a safe API; do not use a shared staff cookie to proxy arbitrary guest queries.
- Each history request derives the guest identity from the secure session and approved mapping, never an untrusted browser-provided GuestCode.
- Lumen creates and maintains permanent guest records under approved staff workflow; new portal registrations remain local logs until securely linked. Do not automatically create Lumen records or deduplicate by phone alone.
- Protect source exports and API secrets; never upload guest records, staff cookies or DB backups to public GitHub.

## Prerequisites and owners
| Dependency | Owner | Blocker |
| --- | --- | --- |
| Verified business content and hotel-owned images | Hotel owner | Public brochure launch |
| Channel manager contract + booking engine or API approval | Hotel owner/provider | Real online booking |
| Production database and auth provider accounts | Developer/owner | Guest accounts and dashboard |
| SMS provider and verified sending setup | Owner/provider | Real phone OTP |
| Approved Lumen guest export / vetted read-only integration | PMS admin/owner | Historical stays and rewards |
| Staff reservation-reconciliation procedure | Front desk manager | Inventory oversell prevention |
| Production hosting and DNS confirmation | Owner/developer | Production go-live |

## Immediate engineering order
1. Keep prototype operational but marked demo; do not use sample OTP for production.
2. Add production database schema and independent role-based staff authentication.
3. Build the internal arrival dashboard with synthetic data and manual Lumen entry state.
4. Build real guest authentication and verified Lumen GuestCode/GuestID linking; then enable guest-specific, read-only history and points queries.
5. Keep OTA/channel-manager integrations disabled until requested again.

## Current status
This file is an implementation plan; it is **not a claim that database, SMS, provider API, payments or live reservations are deployed**. The existing GitHub repository also contains a Lumen source ZIP in a PUBLIC repository; investigate and remediate reported credential exposure before processing any real guest data. See docs/START-HERE-AT-HOME.md.

## Owner decision — Cloudflare and Lumen authoritative data (2026-10-29)
The website database is **not** a second PMS. Store website account registration, OTP auth metadata, verified PMS ID mapping, permissions, and audit logs in Cloudflare D1. Lumen is authoritative for guest profiles, stays, rewards, payments and folios. Guest history and points are requested from Lumen via a properly secured integration when needed; use explicit short-lived caching only if approved. Phone numbers and GuestCodes are identifiers, not sufficient proof to access another person's history. No channel manager work at this time.

## Guest vs front-desk access rule (owner clarification, 2026-10-29)
- **Guest UI:** phone number -> server-validated SMS OTP -> secure session -> system resolves already-verified portal-to-Lumen GuestID/GuestCode mapping internally -> shows ONLY their own profile, eligible stays, and reward balance. No guest search, guest code lookup form, guest picker, or client-selected Lumen GuestID.
- **Staff UI:** authorized front-desk personnel may search guest records by phone, name, GuestCode and GuestID to assist with verified linking, correction and reconciliation. Implement role-based authorization and audit searches.
- **First-time/ambiguous matches:** phone OTP alone does not authorize viewing a historical PMS record (phone reassignment/shared numbers). Background candidate matching is allowed, but private history remains hidden until account ownership is established, potentially via additional verification/staff approval.
- **Backend:** retrieve Lumen history using GuestID from the server-side verified link, not user-supplied identifiers. Enforce hotel scope and prohibit cross-guest reads.

## Updated owner requirement — direct website reservations into Lumen (2026-10-29)
**This replaces the previous 'no Lumen booking writes' rule for direct website reservations only.** Channel-manager/OTA work remains paused.

- Guest submits an overnight reservation on Crystal Inn website. The integration creates a `Booked` reservation in Lumen with `HotelRoomID = null`; website retains the returned `HotelRoomBookingID` and Lumen `BookingCode` as the reconciliation keys.
- Authorized front desk sees the booking in Lumen's **New Arrivals** for the arrival date, then assigns a physical room manually at arrival/check-in. Verify the existing Lumen screen query includes unassigned `Booked` records and that arrival dates are interpreted correctly.
- Website cancellation calls Lumen's `RoomCancel/{hotelRoomBookingID}` with reason; verify it is shown in the PMS **Cancelled** booking section. Do not merely delete a website database row.
- A guest can only cancel an existing website-originated reservation linked to their authenticated account, and only while policy/status permits. Staff also need an authorized cancellation workflow.
- Treat Lumen as the authoritative booking status after successful write; the website keeps operation/event IDs, booking mapping, sync state and audit log. Persist PendingSync/Confirmed/SyncFailed/Cancelled states; reconcile unknown results and use idempotency so retries do not duplicate bookings.
- **Critical blockers before production enablement (from feature iteration 11 source review):** `AddHotelRoomBooking` reportedly does not recheck inventory transactionally, risking overselling; it matches/upserts guests on identity number including null, potentially overwriting an unrelated record; broad staff authorization and other exposed credential concerns exist. Do not send untrusted web requests straight to these APIs. Obtain a safe, narrowly scoped server-to-server booking endpoint (preferably a hardened Lumen adapter/action), fixes or approved safe mapping for guests, and authoritative allotment checks first.
- Test end to end in staging against real Lumen UI with synthetic guest accounts: create without room assignment; display in New Arrivals; assign and check in at desk; cancel and display in Cancelled; avoid duplicate guest/booking records; verify refund and confirmation policy.
- **Do not claim this integration is already deployed.** The Cloudflare reservation-request module currently only stores requests and staff dispositions separately; it requires a new integration before website booking creates a PMS record.
