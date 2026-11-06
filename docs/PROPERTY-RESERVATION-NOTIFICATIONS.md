# Crystal Inn: registered PMS names and hotel/guest reservation notifications

## Current rollout scope

- **Northwest 290 only**: The existing `/book` flow and `POST /api/reservations` still create a **request**, not a confirmed Lumen PMS booking. No room is held or guaranteed.
- For a securely signed-in portal guest, the UI uses a **registered Lumen name** only if BOTH (a) `portal_guest_lumen_links` has an independently verified, unrevoked ownership link for that hotel/GuestID, AND (b) a developer-authorized PMS integration has stored the matching registered name in `portal_guest_verified_pms_names`. These snapshots **are not automatically created by the current Lumen cookie sign-in pilot**.
- Existing guests without a trusted PMS snapshot, and new guests, enter their own contact details. These names are marked `guest_entered` and must be reconciled by front-desk staff before creating a PMS booking. Do not treat SMS OTP as PMS identity proof.
- Submission saves three independent notification intentions, atomically with the website request: property email, guest email, and optionally opted-in guest SMS.
- Property inbox is `hotel_reservation_settings.booking_notification_email` if set, else `hotels.public_email`. There is no global or cross-property fallback inbox. Each property admin configures their own address in **Hotel Admin → Reservation notifications**.
- Guest email states **REQUEST RECEIVED — NOT CONFIRMED**. Guest SMS also states it is not confirmed and includes instructions to opt out. Messages never say a room is booked until Lumen or authorized staff later confirms it.
- Property manager can open **Hotel Admin → Reservations**, select an existing Northwest 290 website request, verify it is booked in Northwest 290 Lumen PMS, enter the **actual PMS booking reference**, check the explicit attestation and click **Confirm booking and notify guest**. This changes the website's legacy request to a staff-confirmed reservation and separately queues a **CONFIRMED** guest email and opted-in SMS. It does **not** create a booking in Lumen, automatically verify the PMS reference, or validate availability on its own.

## Migration and activation

1. **Back up production Cloudflare D1** `crystal-inn-reservations`.
2. Run the complete statements in `migrations/0012_reservation_notifications_and_pms_names.sql` **once**, AFTER 0011 and BEFORE deploying the new code. The first two `ALTER TABLE` statements intentionally are not safe to rerun.
3. Verify:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hotel_reservation_settings','reservation_notification_jobs','portal_guest_verified_pms_names');
   PRAGMA table_info(reservations);
   ```
4. Merge and deploy the corresponding code after all GitHub checks pass.
5. In **Hotel Admin → Reservation notifications**, enter the property's own front desk/booking inbox. Save. Configure guest email and SMS channel toggles.
6. Configure and test provider credentials listed below. Do not send a real guest test until both recipient and property inbox are approved.

## Cloudflare Worker secrets and operational settings

**Email with Resend** (the existing booking code already attempted Resend, but the new code uses Cloudflare Worker bindings rather than process.env):

```text
RESEND_API_KEY=<encrypted Resend API credential>
RESERVATION_FROM_EMAIL=<verified sending domain mailbox, e.g. reservations@verified-domain.example>
```

Resend requires sending domain verification (DKIM/SPF) for production. The domain's existing Microsoft mail hosting for incoming email can stay separate; set DNS carefully so sending setup does not break Microsoft inbound mail. The property booking inbox is set in hotel-admin; it is NOT hard-coded in Worker secrets.

**SMS with Twilio Programmable Messaging** — distinct from Twilio Verify OTP:

```text
TWILIO_ACCOUNT_SID=<Twilio account SID>
TWILIO_API_KEY=<Twilio API key SID>
TWILIO_API_SECRET=<Twilio API key secret>
TWILIO_MESSAGING_SERVICE_SID=<Twilio Messaging Service SID>
RESERVATION_SMS_ENABLED=false
```

Use a Twilio Messaging Service with a registered compliant sender for US A2P transactional messages, opt-out management and no promotional messaging. After approval set `RESERVATION_SMS_ENABLED=true`. SMS still requires the property toggle and explicit guest consent per reservation. Trial Twilio accounts may only message approved phone numbers. Test STOP/opt-out behavior before going live.

The source contains no real credentials or tokens.

## What code now handles

- `app/api/reservations/route.ts`: writes request + notification jobs in one D1 transaction; uses approved PMS name if one is independently verified; returns per-channel provider acceptance, never claims hotel confirmation.
- `lib/reservation-notifications.ts`: chooses the hotel-specific inbox, sends Resend transactional messages and optionally Twilio SMS, tracks each channel independently. Provider acceptance is NOT guaranteed delivery. Resend uses a stable idempotency key per job.
- `app/api/hotel/reservation-notifications/route.ts`: hotel-scoped settings, provider readiness, job counts and manual retry by CI reference. Only NW290 legacy requests can be retried. Retries skip already accepted messages and refuse unknown processing outcomes that might produce duplicate SMS.
- `app/api/hotel/reservations/confirm/route.ts`: Northwest 290 hotel-manager-only, explicit staff attestation and mandatory PMS booking reference. Atomically updates website booking status and enqueues confirmed guest email/SMS, without writing anything to Lumen.
- `app/api/hotel/dashboard/route.ts`: also shows existing Northwest 290 legacy website requests in its own hotel-admin reservations table, never in another hotel's view.
- `app/book/page.tsx`: shows canonical name as read-only if verified, otherwise editable; guest SMS opt-in and clear delivery caveats.
- `app/api/guest/me/route.ts`: returns registered PMS name only if the link is verified AND the snapshot matches the exact hotel and Lumen GuestID.

## Pending Lumen developer requirements

1. Provide approved tenant-scoped API credentials and an identity endpoint proving Northwest 290 HotelID=4 and the exact PMS instance. The cookie pilot currently proves only login; no guest data operations are enabled.
2. Provide a sanitized **read-only guest profile API** with `GuestID`, `GuestCode`, registered first/last name, and only the contact fields authorized for this hotel. No driver license number, ID scan or government document image.
3. Define the independent guest-to-PMS ownership-verification and staff-approval process. Only after successful verification may the connector populate `portal_guest_verified_pms_names` under the matched `hotel_id + portal_user_id + lumen_guest_id`. There is deliberately no public write API for this table.
4. Provide an idempotent PMS booking creation and status API so automated confirmations can replace the present **manual staff-attested** PMS confirmation. A hotel manager may currently initiate confirmation notifications *only after personally verifying the PMS booking and entering its real booking reference*. The website cannot independently verify this booking yet. When the PMS integration is approved, automatically verify status and prevent false confirmations, duplicate bookings, and cancellations.
5. Ensure email/SMS delivery logs and provider webhook handling for delivered/bounced/failed states. Current status `accepted` means only provider accepted the send request.

## Limitations requiring operational sign-off

- No automatic background notification retry worker is installed. Missing provider settings leave jobs pending. The property manager can retry by reference after setup. Errors may leave jobs in `failed` (up to three attempts). Unknown outcomes remain `processing` pending manual reconciliation, to avoid SMS duplicates.
- A live website request still does not appear in Lumen New Arrivals; staff must check website/legacy admin and Lumen separately until an approved synchronization is delivered.
- Avoid promising guaranteed immediate notifications or confirmed stays until the integrations are configured and end-to-end tested.
