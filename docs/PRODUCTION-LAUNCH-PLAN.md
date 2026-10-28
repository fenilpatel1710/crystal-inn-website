# Production Launch Plan — Crystal Inn Northwest 290
Updated: 2026-10-28

## Agreed architecture
- **Lumen PMS unchanged:** manages short stays, walk-ins, physical room assignment, housekeeping, folios and historical guest codes.
- **Approved channel manager:** staff manually set date/room-type allotment; shared inventory is synchronized across Booking.com, Expedia and Crystal Inn direct bookings. Online reservations do **not** automatically block Lumen rooms.
- **Crystal Guest Portal:** separate secure SMS OTP login; verified link to existing Lumen GuestID + GuestCode. History shown only after linking and authorization.
- **Front desk:** notifications and daily-arrivals board; staff manually record online reservations in Lumen.
- **Initial rollout:** one Crystal Inn property, not multi-hotel.

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

### Release 2: Live direct reservations
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

### Release 4: Existing guest history / rewards
- Start with encrypted, authorized property-scoped export/import (or vetted, narrowly scoped read-only server integration) from Lumen.
- Store guest code/id mapping, completed stays and reward ledger, source IDs and last-synced timestamps.
- History access derived exclusively from authenticated portal user plus *verified* approved linkage; prevent enumeration or cross-guest access.
- Protect source exports; do not upload real guest records, staff cookies or DB backups to public GitHub.
- Keep offline/short-stay records independent of channel manager reservations and reconcile duplicates.

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
4. Connect approved channel manager data feed after provider confirmed; test reservation and inventory events.
5. Build real guest authentication and verified linking; then enable history.

## Current status
This file is an implementation plan; it is **not a claim that database, SMS, provider API, payments or live reservations are deployed**. The existing GitHub repository also contains a Lumen source ZIP in a PUBLIC repository; investigate and remediate reported credential exposure before processing any real guest data. See docs/START-HERE-AT-HOME.md.
