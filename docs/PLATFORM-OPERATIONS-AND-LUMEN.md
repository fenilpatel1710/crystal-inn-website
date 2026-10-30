# Crystal Inn — Multi-hotel operations and Lumen property mapping

Source changes are committed to GitHub main. Cloudflare production deployment and migration 0005 are not verified.

## Confirmed Lumen mapping
The previously supplied Crystal Inn Northwest 290 Lumen room API payloads contain top-level `hotelID: 4` alongside `businessLLCName: "Crystal Inn NW/290"` in nested hotel data. Some nested empty/dummy objects contain `hotelID: 0`; do not use those placeholders. We therefore map:
- Crystal Inn website hotel ID: `crystal-inn-northwest-290`
- Lumen hotelID: integer `4`
- Other Crystal Inns: only enter their Lumen hotelID after verifying against their individual PMS installation. IDs are not globally unique across separate Lumen databases; always scope by website hotel AND its own integration configuration.

## Cloudflare D1 migration (required before new deployment)
1. Back up `crystal-inn-reservations` through Cloudflare D1 Time Travel/export.
2. Run the statements in `migrations/0005_platform_operations_cloudflare.sql` once in the D1 Console.
3. Verify `PRAGMA table_info(hotels);`, then `SELECT lumen_hotel_id FROM hotels WHERE id='crystal-inn-northwest-290';` should give `4`.
4. Verify `guest_inquiries` and `platform_settings` exist.

This migration adds only new columns/tables and seeds Northwest's Lumen identifier. It does not modify legacy reservations.

## New Super Admin workflow
- Overview with hotel, manager and inquiry counts.
- Hotels: create draft, edit public hotel metadata, enter numeric Lumen Hotel ID, activate/suspend, archive/restore, rewards toggle.
- Managers: create, suspend/reactivate, delete manager assignment, manual password reset, one-time reset link.
- Featured Hotels: manual date/position scheduling and room photo URL override.
- Rewards: participating hotel switches; the page does not transact points.
- Subscriptions: manual hotel billing status, monthly amount and renewal date. Does not collect payment.
- Guest Inquiries: list and mark new/in progress/resolved.
- Activity: recent Super Admin actions.
- Settings: network inquiry email; current published rewards formula remains fixed pending actual PMS ledger integration.

## Guest website
- `/request-stay` selects the hotel before proceeding; Northwest 290 uses its legacy request route, while other hotels currently show their property pages pending verified booking integration.
- `/contact` saves requests in D1 and optionally emails the central mailbox using already-supported Resend secrets.
- Featured hotels use active, real hotel records and room-photo URLs.
- Individual hotel detail pages and guest rewards page were already present.

## Not completed
- Verified Lumen PMS API adapter: separate PMS endpoints, credentials, network routes, authentication, room type mapping, guest identity, booking creation, transaction consistency, and payment handling are not connected.
- Real SMS OTP, live rewards balances, actual subscription billing, and invoice collection.
- Cloudflare production build verification and end-to-end QA across hotels.
- Lumen integrations must be read-only/test-environment first, then per-property controlled rollout.

## Production checklist
- Execute D1 migration 0005 once after backup.
- Verify latest Cloudflare Worker deployment success (Vercel status alone is not sufficient).
- Confirm Northwest 290 `lumen_hotel_id=4` in D1 and Super Admin.
- Test hotel profile saves, subscription records, and inquiry submissions, including Central email notification status.
- Verify public guest forms do not send booking confirmations automatically.
- Ensure every hotel has distinct accounts, identifiers, and authorized integrations.
