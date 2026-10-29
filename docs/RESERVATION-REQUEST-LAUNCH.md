# Crystal Inn reservation-request launch (Cloudflare)
This is **not** a booking engine or a Lumen integration. It sends a reservation REQUEST to the front desk by email. The website must not promise a room. No payment is charged.

## New files
- `/book` — guest request form (dates, room preference, quantity, contact details).
- `POST /api/reservations` — validated server-side request endpoint; delivers request to front desk through Resend; sends success to guest's browser only when Resend accepts the message.
- Existing homepage's booking CTA should direct to `/book`.

## Activate through Cloudflare dashboard (no PowerShell)
1. Create a Resend account and verify that you control `crystalinnstay.com` by adding its required DNS records in Cloudflare. Review existing MX/SPF/DKIM before adding records.
2. In Cloudflare > Workers & Pages > crystal-inn-website > Settings > Variables and Secrets, add **encrypted secrets**:
   - `RESEND_API_KEY` — restricted API key from Resend, not in GitHub.
   - `RESERVATION_NOTIFY_EMAIL` — set to **`frontdesk@crystalinnstay.com`** (the operator-designated inbox for all hotel reservation records and Lumen sync failure alerts).
   - `RESERVATION_FROM_EMAIL` — verified sender address (e.g. `reservations@crystalinnstay.com`).
3. Redeploy if necessary to ensure secrets are available at runtime.
4. Test on `https://crystalinnstay.com/book` using *synthetic* contact details. Verify the message actually reaches the monitored inbox, that its date/type information is correct, and that frontend calls the request a request only.
5. Train front desk to read every request, check actual Lumen availability, manually create and confirm the booking and record guest reply. The email is **not** proof of a booked room.
6. For production readiness, add rate limiting, anti-abuse protection, persistent database/audit log, monitoring and retry/reconciliation before relying on this channel as the only way to capture requests. Currently email-only: requests can be missed if recipient mailbox fails later. Do not advertise instant booking.

## Lumen roadmap
The planned write integration must create a Booked reservation with **no assigned physical room** and appear in Lumen's New Arrivals. Website cancellations must update the same reservation via the authorized Lumen cancellation endpoint. However, previous Lumen source review found guest matching and availability race-condition concerns, so this remains **disabled** until secured and staging-tested.


## Mandatory reservation email backup and Lumen failure handling
Operator requirement (October 29, 2026): **Every website reservation must have a detailed hotel-email record as a backup if Lumen integration fails.** This requirement applies even when the Lumen sync succeeds. Preserve existing room images; this task is backend only.

### Target production sequence
1. Validate dates, room type, allotment, rate, taxes, guest contact details and terms server-side; verify guest access where appropriate.
2. Atomically create a unique reservation row in D1 with immutable pricing snapshot, booking status and Lumen sync state. Add unique idempotency key and unique mapping for the Lumen booking ID. Never acknowledge successful persistence until the D1 transaction commits.
3. Atomically create **outbox events** for (a) hotel booking-email record and (b) Lumen sync, rather than treating an attempted API call as proof of delivery. Worker or queue consumer retries with bounded exponential backoff and dead-letter/manual escalation.
4. Send **every** reservation to a monitored hotel inbox via Resend or another verified mail provider, regardless of the Lumen sync result. Email subject includes website booking reference and status; body includes guest contact, dates, room type, rooms, guests, rate and tax breakdown, total, special requests, booked-at timestamp, website reference, current Lumen status and ID if known. Explicitly state provisional versus confirmed. Avoid full payment-card data and secrets.
5. On Lumen failure or timeout: retain original row and email event, mark `sync_failed` or `sync_unknown`, and send a **high-priority follow-up alert**. A timeout is not proof that Lumen did not create the booking: reconcile by website reference before any retry to prevent duplicates.
6. Staff dashboard shows `pending`, `synced`, `failed`, `unknown` and `manual_review`, manual retry controls, timestamps, last error without sensitive internal details, and audit history. If email delivery fails, keep the outbox event and show an independent alert in staff dashboard; never present email as sole source of record.
7. Guest-facing acknowledgement only promises a **reservation request** until the hotel can guarantee inventory and safe Lumen booking creation. A reservation is confirmed only after policy-defined secure confirmation and written guest notification. Avoid overselling from asynchronous Lumen failures.
8. Ensure hotel inbox has access controls, retention rules and a minimal-PII policy. Test all paths (success, provider failure, network timeout, duplicate submission, delayed retry, Lumen-created-but-response-lost and manual override) prior to enabling live bookings.

### Current implementation limitations
The current `POST /api/reservations` sends **one request email**, only if the three Resend environment variables are configured, and returns 503 when not configured or provider refuses the request. It does **not** persist a reservation in D1, implement an outbox/retries, guarantee inbox delivery, or call Lumen. The above is a **future implementation specification**, not deployed functionality.

## Designated hotel recipient

The operator designated **frontdesk@crystalinnstay.com** to receive every website reservation email and additional Lumen synchronization-failure alerts. Keep the recipient configurable via Cloudflare Worker environment variables rather than hardcoding it into public website source. This is the recipient address, **not** the sender address. The notification endpoint requires an active `RESEND_API_KEY` and separately verified `RESERVATION_FROM_EMAIL`; no automatic emails can be assumed delivered until those are configured and tested. The Lumen failure-alert workflow is not implemented yet.
