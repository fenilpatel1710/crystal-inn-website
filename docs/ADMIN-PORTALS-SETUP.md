# Super Admin + Hotel Admin: setup and limitations

## Current status
The code for a multi-hotel management console is committed, but NOT automatically activated on production. Existing Northwest 290 `/admin` and legacy reservations still use their original tables and login, and remain separate from these new portals.

- `/platform-admin`: master operator sign-in, add hotels in draft mode, review assigned managers, create hotel manager credentials, activate/suspend hotels.
- `/hotel-admin`: signed-in hotel manager selects an active hotel, views hotel-scoped reservation records, adds/edits room categories/descriptions, and manages nightly rates/allotments/stop sell.
- New tenants have `hotel_id` enforced in server queries. Hotel access is checked against active DB membership on each request.
- Platform secrets and manager passwords are not exposed to public/browser code. Passwords for managers are salted and scrypt hashed. Cloudflare environment secrets never belong in GitHub.
- The hotel UI only shows active hotels. New hotels default to draft; the super admin must create a manager and activate the hotel.
- **Do not accept live reservations in this new system until the booking migration has passed cross-hotel isolation tests.** Lumen remains disconnected.

## Required Cloudflare secrets

In Workers & Pages → your Worker → Settings → Variables and Secrets (production), set:
- `PLATFORM_ADMIN_EMAIL`: a platform-owner email, ideally separate from hotel managers.
- `PLATFORM_ADMIN_PASSWORD`: new unique password of at least 16 characters.
- `ADMIN_SESSION_SECRET`: keep the existing high-entropy (32+ byte) signing secret; used by both legacy and new sessions.
- `DB`: keep your existing D1 binding.

Never reuse the property admin password for platform admin.

## D1 migration

Before executing any migration, back up production D1 and verify the existing tables and data. Review `migrations/0003_multi_property_foundation_DRAFT.sql`. It creates multi-hotel tables additively and seeds Northwest 290 as a draft without touching original reservations.

Execution in Cloudflare D1 Console requires the SQL body. This file is a reviewable **draft**, not an auto-run migration. It must be verified and applied once by an authorized operator.

The new endpoints read/write only `hotels`, `hotel_admin_users`, `hotel_admin_memberships`, `hotel_room_types`, `hotel_nightly_inventory`, and `hotel_reservations` plus existing login-attempts table. They will not function until that schema exists.

## Setup sequence

1. Verify the new code builds in preview and the old booking/admin workflows still pass.
2. Configure Cloudflare platform secrets and ensure D1 migration exists.
3. Sign into `/platform-admin` with the platform operator's own credentials.
4. Add hotel (or find seeded Northwest 290).
5. Add a property manager account and assign its initial password; deliver securely to the manager.
6. Activate the hotel.
7. Sign into `/hotel-admin`, select the active hotel, enter its manager credentials.
8. Add rooms, descriptions, rates and availability. These are website settings, not PMS availability.
9. Repeat for other hotels; test that hotel A can never view or write hotel B's records.

## Important remaining features before production release
- Mandatory manager password reset/change and recovery, invitations instead of manually distributing passwords, account lock/suspension tools, stronger authentication (MFA), and manager account rotation.
- Hotel-by-hotel Lumen PMS connection management using independent server-side secret references and independent PMS databases. `lib/lumen/server.ts` is currently a proposed single-instance adapter only.
- Migrate/reconcile Northwest 290 legacy reservations and room inventory to hotel-scoped tables. Existing reservations will not show in the new hotel dashboard until migrated.
- Hotel-specific public pages, scoped booking checkout, rate publication rules, actual guest SMS OTP, guest accounts and rewards.
- Add a full property-level audit trail for user and rate changes, testing, backups, privacy safeguards, rollback and migration review.
- Review Cloudflare Worker runtime support for Node crypto (scrypt) and ensure end-to-end build/preview tests pass. Do not deploy admin pages to public production untested.
