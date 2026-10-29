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
   - `RESERVATION_NOTIFY_EMAIL` — mailbox that front desk actually monitors (e.g. an existing inbox).
   - `RESERVATION_FROM_EMAIL` — verified sender address (e.g. `reservations@crystalinnstay.com`).
3. Redeploy if necessary to ensure secrets are available at runtime.
4. Test on `https://crystalinnstay.com/book` using *synthetic* contact details. Verify the message actually reaches the monitored inbox, that its date/type information is correct, and that frontend calls the request a request only.
5. Train front desk to read every request, check actual Lumen availability, manually create and confirm the booking and record guest reply. The email is **not** proof of a booked room.
6. For production readiness, add rate limiting, anti-abuse protection, persistent database/audit log, monitoring and retry/reconciliation before relying on this channel as the only way to capture requests. Currently email-only: requests can be missed if recipient mailbox fails later. Do not advertise instant booking.

## Lumen roadmap
The planned write integration must create a Booked reservation with **no assigned physical room** and appear in Lumen's New Arrivals. Website cancellations must update the same reservation via the authorized Lumen cancellation endpoint. However, previous Lumen source review found guest matching and availability race-condition concerns, so this remains **disabled** until secured and staging-tested.
