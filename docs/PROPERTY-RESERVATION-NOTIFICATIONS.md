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

**Email with Google Workspace via the Gmail API** (Resend is no longer used by reservation notifications):

Set up a dedicated Google Workspace mailbox that exists on the verified Workspace domain, or an authorized send-as alias. The website sends guest and front-desk emails from that mailbox through the Gmail API. The receiving property address may remain `crystalinngessner@gmail.com` and is configured separately under Hotel Admin.

1. In <https://console.cloud.google.com>, create/select a Google Cloud project under the Workspace organization. Enable **Gmail API**.
2. Configure the app's Google Auth Platform consent screen as **Internal** if the Workspace organization permits this. Create a **Web application OAuth client**. Authorize the exact sender account only with `https://www.googleapis.com/auth/gmail.send` and **offline** access; have a developer perform the initial interactive OAuth authorization-code flow, securely capturing the refresh token outside of chat and GitHub. Use a production/internal authorization configuration so the refresh token is not subject to the short testing expiration for external OAuth apps.
3. Store the following in **Cloudflare → Workers & Pages → crystal-inn-website → Settings → Variables and Secrets**. Secrets must be encrypted, not committed:
   ```text
   GOOGLE_WORKSPACE_EMAIL_ENABLED=false
   GOOGLE_WORKSPACE_FROM_EMAIL=<the actual authorized Google Workspace sender mailbox>
   GOOGLE_WORKSPACE_OAUTH_CLIENT_ID=<Google OAuth 2 client ID>
   GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET=<encrypted OAuth client secret>
   GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN=<encrypted offline-refresh token with gmail.send permission>
   ```
4. After Google Workspace successfully authorizes the mailbox and the website build is deployed, switch `GOOGLE_WORKSPACE_EMAIL_ENABLED=true`. Then send a controlled test request and inspect the property Gmail inbox and sender Workspace **Sent** folder. Never claim delivery just because Gmail API returned a message ID.
5. Do **not** change Workspace inbound MX, SPF, or DKIM for this integration; Gmail API uses the existing mailbox identity and domain configuration, not a new third-party outbound domain.

Google API integration uses `POST https://oauth2.googleapis.com/token` to refresh a short-lived access token, then `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with a base64url-encoded MIME message. The code is HTTP-only and compatible with Cloudflare Workers. Quotas and applicable Google API billing thresholds must be checked in the owning Google Cloud project. Gmail send API does **not** expose a send-idempotency key: if the request outcome is uncertain, the corresponding notification job stays in `processing` for manual review against the sending mailbox's Sent folder before retrying.

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
- `lib/reservation-notifications.ts`: chooses the hotel-specific inbox, sends Google Workspace Gmail API transactional messages and optionally Twilio SMS, tracks each channel independently. Provider acceptance is NOT guaranteed delivery. Gmail API has no send-idempotency key, so ambiguous send outcomes require manual reconciliation.
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
