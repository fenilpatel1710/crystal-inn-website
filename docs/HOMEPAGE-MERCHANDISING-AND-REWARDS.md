# Crystal Inn homepage marketplace and participating rewards

## Completed in source
- Public "Request a stay" CTA points to `/request-stay`, where a guest first chooses a hotel and then confirms dates and guests. Existing Northwest 290 is the only property with an enabled website request form. Other hotels show their property details while booking integration is pending.
- The homepage displays a searchable directory of real active hotels, with a legacy Northwest 290 fallback until the platform database is initialized.
- The homepage's former single-hotel "featured rooms" section now displays up to **five actual hotels**, with hotel name, location and an authentic hotel room photo when configured. Feature photos use a Super Admin-supplied image URL first, then the hotel's own room photo, then the hotel cover photo. No fabricated properties or photos. If no features have been scheduled, a clear neutral empty state appears (no fabricated placements).
- `/platform-admin` lets the platform operator select an active hotel, an optional specific feature-room image URL, a start and end date (inclusive), and a position 1–5. Overlapping hotel placements or positions are rejected. Placements can be removed. This is manual sponsored/editorial scheduling; **no payment or automatic billing logic** is connected.
- Super Admin can mark a hotel as eligible for rewards. All hotels default to **not participating**. Guest rewards page lists only active participating hotels.
- Rewards landing states that the program is valid at participating hotels only. The details page states the currently described 3 points per eligible $1, **minimum 1,000 points to redeem**, and the previously described 1,000-point / $10 hotel credit illustration. These are published policy descriptions, **not live reward accrual, point posting or redemption**. Each hotel needs its own confirmed terms and Lumen integration before live reward transactions.
- Plan Your Stay lists available hotel locations, using property page links. General guest enquiries use `frontdesk@crystalinnstay.com` by `mailto:`; no shared telephone number is advertised as the platform contact.
- Hotel administrators can edit their property public description, contact details, room information and hotel's cover image URL using hotel-scoped APIs. A hotel manager cannot choose their own feature placement or reward eligibility.

## Migration required before platform controls work
The reviewed additive `migrations/0003_multi_property_foundation_DRAFT.sql` now includes:
- `hotels.rewards_enabled` (0/1, defaults 0).
- `hotels.hero_image_url` (existing draft field).
- `featured_hotel_placements` with hotel ID, start/end dates, position 1–5 and an optional specific feature-room image URL.
The SQL has not been executed on production. Back up D1 and reconcile the final migration with any already installed tables; `CREATE TABLE IF NOT EXISTS` does not add missing columns to an existing table.

## Required verification
1. Confirm clean Next.js and Cloudflare OpenNext builds on latest main commit.
2. Confirm successful Cloudflare deployment after the build and check desktop/mobile views.
3. Back up D1, apply audited schema, and activate platform secrets.
4. Verify super-admin can add/activate hotels, set each hotel's cover photo through its hotel admin, toggle reward eligibility, and schedule/revoke featured placement.
5. Confirm five slot limit, non-overlapping hotel/position date ranges, Central time date selection and fallback behavior.
6. Confirm visiting `/request-stay` starts with hotel selection and non-integrated hotels cannot submit to Northwest 290's booking endpoint.
7. Ensure rewards legal terms, cross-hotel transfer rules and credit conversion are confirmed for each participating hotel before activating enrollment or redemption.
8. Confirm that the mailto contact opens the user's email client; a server-side central contact form has not yet been implemented.

## Lumen next phase
Guest verification, points balances, redemption, live rate/availability, and multi-hotel booking require hotel-scoped Lumen adapters, credentials and separate PMS databases. The work above is a UI / configuration foundation only.
