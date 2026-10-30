# CrystalInnStay multi-property architecture — implementation foundation

## Product requirement
CrystalInnStay.com lists participating Crystal Inn hotels. Northwest 290 is the first property, not the whole brand. Each hotel manages its own rates, rooms, photos, reservations, staff, rewards, and guest accounts. Lumen is the common PMS software but each hotel has its own credentials and independent PMS database.

## Security model
- Platform operator has a separate platform-admin identity for onboarding hotels, branding and system maintenance.
- Property admins only receive hotel-scoped memberships. The current crystalinngessner@gmail.com credential will belong to Northwest 290 after migration, not to the platform superadmin role by default.
- Every admin session includes a **server-signed hotel_id and role**. For multi-hotel staff, a property switch requires an explicitly authorized membership. The API determines hotel_id from the session and verified membership; never trust hotel_id supplied in a request body or path as authorization.
- Guest sign-in always starts with an explicit hotel selection. Phone verification and Lumen guest-linking are performed within that hotel's scope. The same phone can have separate guest IDs at separate hotels. Never search a global guest table and reuse another hotel's match.
- Do not use a shared administrator password as the long-term multi-tenant identity scheme. Use unique staff accounts, salted password hashes or a managed authentication service, and secure recovery, audit and rate limits.
- Central platform D1 may store hotel_id-scoped website records. Lumen **PMS databases** remain separate; if clients demand complete database isolation, use one D1 per hotel with a carefully scoped connection registry.
- Integration credentials stay server-side in per-hotel secret storage. Store only a non-secret reference and connection status in the platform registry.
- Every query, export, write, outbox event and background job must be hotel-scoped and tested against cross-hotel access.
- The database structure must enforce scoped foreign keys, not only application filters. Never expose full Lumen PMS login or cookies to the browser.

## Page structure
- `/`: Crystal Inn brand homepage and a verified participating hotel directory. Do not advertise imaginary properties.
- `/hotels/[slug]`: each hotel's public page, photos, amenities, property phone and reservation actions.
- `/hotels/[slug]/book`: property-specific request form. The server resolves the slug to hotel ID before persisting anything.
- `/hotels/[slug]/guest`: property-specific OTP sign-in and rewards, stay history and cancellations, limited to that hotel's records.
- `/admin`: hotel administrator login; a property-scoped dashboard only after a valid hotel membership is selected.
- `/platform-admin`: centrally operated, separately authenticated onboarding and global brand settings.

## Booking flow
Hotel selected → server resolves active hotel → validates room/category, dates, availability, rates → writes hotel-scoped request or confirmed booking atomically → queues hotel-scoped notifications and Lumen sync. Until those components are verified, submit **request only**, never auto-confirm.

## Lumen integration
The current `lib/lumen/server.ts` is a proposed single-instance adapter, **not** a working PMS integration. Introduce hotel-bound adapters and secret references only after reviewing each hotel's PMS endpoint, credentials, database boundary and provider contract. Handle ambiguous network timeouts without duplicate creations, with reconciliation by website booking reference.

## Safe migration plan
1. Back up D1.
2. Review `migrations/0003_multi_property_foundation_DRAFT.sql` (not executed automatically).
3. Create property/role records and a new independent platform-admin identity.
4. Verify that historic Northwest 290 reservations, room-type IDs, availability and guest accounts belong only to that hotel. Do not bulk-copy or delete production records without reconciliation.
5. Migrate one admin and one guest flow at a time, with explicit tenant IDs and regression tests for access isolation.
6. Only then switch the public homepage and booking forms to hotel-scoped routes.
7. Add hotel B only after hotel A passes isolation, booking, cancellation and admin permissions tests.

**Status:** Architecture and draft migration committed. Live endpoints, bookings and existing dashboard still operate in original single-property mode; no production database migration has been run.
