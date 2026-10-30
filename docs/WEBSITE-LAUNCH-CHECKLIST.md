# CrystalInnStay — website launch checklist (2026-10-30)

## Architecture decision
Keep existing Next.js + Cloudflare Workers/OpenNext + D1. The site is **hybrid**: brand marketing is mostly static; public hotel directory and property profiles are database-backed; hotel admins, reservations and auth use dynamic server APIs. Do not change to `output: 'export'` or static-only Cloudflare Pages.

## Public website now committed in code
- Central Crystal Inn brand homepage with real hotel directory (Northwest 290 featured until other real properties activate).
- Search hotels by name or location.
- Dynamic `/hotels/[slug]` pages using per-property profile, contact, rooms, room image links and descriptions.
- Northwest 290 reservation requests still use existing `/book` and legacy D1 reservation table. No auto-confirmation.
- Guest portal starts with hotel selection; real phone OTP and stay data intentionally unavailable before Lumen integration. No fabricated login or history.
- Property admins can update their own description, phone, contact email, address, room categories, room image links, date-specific rate, allotment and stop-sell.
- Platform operator can create/suspend hotels; create/suspend/reactivate manager accounts and change initial/reset password.

## Required BEFORE production activation
1. Verify successful GitHub Actions Next.js build AND Cloudflare OpenNext build. Check the GitHub workflow `.github/workflows/website-build.yml`. Vercel checks are not proof of Cloudflare deployments.
2. Backup the existing D1 production database **before** applying the reviewed additive `migrations/0003_multi_property_foundation_DRAFT.sql`.
3. Review this migration carefully: it seeds Northwest 290 as a draft. It does **not** migrate legacy reservations/inventory.
4. Set `PLATFORM_ADMIN_EMAIL` and unique 16+ char `PLATFORM_ADMIN_PASSWORD` as Cloudflare encrypted secrets. Keep `ADMIN_SESSION_SECRET` unchanged and `DB` binding correct.
5. Perform a secure `/platform-admin` login. Create a distinct hotel manager identity for Northwest 290. Activate the hotel in the platform dashboard.
6. Verify `/hotel-admin` rates, room descriptions, contact/profile, room image links and reservation visibility for hotel A.
7. Verify hotel B cannot read, edit or enumerate hotel A's records via API/URL changes. Verify suspended staff lose access immediately.
8. Reconcile and migrate Northwest 290 historic reservations and inventory, keeping references, idempotency keys, audit records, and notification status. Do not double-confirm or delete records.
9. Test mobile navigation, date validation, email notification, guest-facing confirmation language, room display and domain HTTPS.
10. Keep other hotels' online booking **disabled** until their website bookings and PMS integration are ready. New public property pages currently provide hotel contacts, not unverified real-time booking.
11. Prefer managed invitations and forced password changes over long-lived temporary passwords. Add MFA, photo upload/storage, booking cancellation/refund workflows and audit trails before opening to additional independent operators.

## Lumen integration phase — NOT YET IMPLEMENTED
- Each hotel must have a validated `hotelId`, its own endpoint, integration credentials (stored only as server-side secrets), and separate Lumen PMS database.
- Lumen is common software, **not** a common guest database. Phone number searches and guest sessions must remain scoped to the selected hotel.
- Verify documented API contract before implementing read/write operations. Never reuse staff browser logins or expose PMS credentials.
- Start read-only: room types, inventory and rates per hotel; then link verified guests; then booking confirmations/write-back with idempotency and reconciliation.
- Existing `lib/lumen/server.ts` is an integration proposal, not proof of live Lumen access.

## Deployment commands
Existing Cloudflare Worker configuration:
- Build: `npm run build:cloudflare`
- Deploy: `npm run deploy:cloudflare`
- Production branch: `main`
- Required D1 binding name: `DB`

**Actual release status:** Code committed, but no successful Cloudflare deployment or production database migration verified in this session. Do not advertise the new admin system as live until validated.
