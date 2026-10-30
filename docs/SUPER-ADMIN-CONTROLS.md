# Crystal Inn Super Admin — Offboarding and Manager Recovery

Changes committed to source code; **not deployed or verified live**.

## Platform controls
- **Archive/remove hotel**: requires double confirmation and exact hotel name. Sets status to suspended, records archive date, removes paid/editorial featured placements, removes it from the public directory, and blocks scoped hotel-admin login. It does not delete reservation, room or audit history. Super Admin may show archived properties and restore them to draft, then re-activate only after manager review.
- **Northwest 290 exception**: legacy /admin and legacy /book still exist. Archiving this property is explicitly blocked until its legacy workflows have been reconciled with the multi-hotel system.
- **Manager access**: Super Admin can suspend/reactivate accounts, manually set a new password, or send a one-time recovery email. Manager can also request a recovery email on Hotel Admin login. Reset link expires after 30 minutes and is single-use. All previously issued property-admin sessions are revoked after password changes using session_version.
- **Manager recovery**: email requests use Resend only if `RESEND_API_KEY` and `RESERVATION_FROM_EMAIL` are configured for the deployed worker. Use a sender address verified with the provider. Reset links use `https://crystalinnstay.com/hotel-admin/reset-password`; do not forward tokens or log them. The Super Admin password is intentionally not resettable using this flow and remains in encrypted Cloudflare secrets.
- **Audit history**: records archival/restoration, hotel status, rewards eligibility, manager access actions, and reset-link requests, with the most recent 100 events visible in Super Admin. This is not a full legal/financial audit system.
- Existing featured hotels, loyalty switches, hotels creation, room configuration and hotel-manager controls remain.

## Important: Apply database migration 0004 once
Before deploying these changes, back up your live Cloudflare D1 database `crystal-inn-reservations`, then run the SQL in `migrations/0004_super_admin_controls.sql` **once** (it includes `ALTER TABLE` statements and is not repeatable).

It adds:
- `hotels.archived_at`
- `hotel_admin_users.credentials_changed_at`
- `hotel_admin_users.session_version`
- `manager_password_reset_tokens`
- `platform_admin_audit`

Check schema with:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN
('manager_password_reset_tokens','platform_admin_audit');
PRAGMA table_info(hotels);
PRAGMA table_info(hotel_admin_users);
```

## Production testing
1. Verify Cloudflare build and deployment from latest main.
2. Confirm platform admin login still works; no real passwords are committed to GitHub.
3. Verify archive/restore with a disposable test hotel; guest history must remain untouched, and archived hotels must disappear from public directory and featured cards.
4. Verify active managers can request a recovery email, that token works once, expires after 30 minutes, that an old token fails, and that pre-reset sessions cannot access hotel admin APIs.
5. Check 403 for hotel manager attempting to call platform-only admin endpoints and for suspended/archived hotel access.
6. Confirm SMTP/email provider configuration and DNS sending-domain verification. Do not assume email was sent until provider accepted it.
7. Check activity audit events, history retention, and Cloudflare D1 backup.
8. Complete Northwest 290 legacy reservation/admin migration before attempting to archive Northwest 290.

## Not implemented
- Hard-deletion of all customer data; this requires policy on retention, audit records and legal requirements, including per-property PMS records.
- Payment billing for featured hotel placement; featured scheduling remains manual.
- Hotel staff invitations by automatic email, MFA, hotel owner transfer, advanced staff roles, PMS integration, guest rewards transactions.
