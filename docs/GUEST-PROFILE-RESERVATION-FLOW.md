# Guest profile and reservation intake (Northwest 290 pilot)

## Guest experience
1. Returning website guest: sign in with Twilio SMS OTP for the hotel. The portal shows their **own saved website contact profile** only. An existing Lumen guest profile/stay/rewards view requires a separate, independently verified portal-to-Lumen link and a secure PMS read-only adapter; it is not connected by this feature.
2. New guest: optionally sign in with SMS before requesting a stay, and enter their first name, last name and email on `/book`. If their submitted mobile matches the OTP-verified phone, the request is atomically associated with their portal account and the website saves their contact profile for future visits.
3. Guests may submit a stay request without an account. Their details remain in the front-desk reservation-request record, and **must not** be automatically linked to an account later based on phone alone.
4. A request is **not** a confirmed booking. The front desk confirms availability, rates and any necessary Lumen entry.
5. Government photo ID is presented and verified/scanned **at the front desk at check-in only** under the hotel's operational policy. The website does not request, store or transmit ID numbers, photos or scans.

## Deployment order
- Back up Cloudflare D1 `crystal-inn-reservations`.
- Confirm migration `0009_guest_login_foundation.sql` has been applied.
- Apply `0010_guest_reservation_profiles.sql` using D1 Console, then verify the two new tables and unique index.
- Merge and deploy this branch only after schema verification.
- Sign in by SMS, submit a synthetic reservation with the verified phone, confirm it shows in the existing admin intake; reload the guest portal and confirm profile details are now shown; sign out and verify no profile is accessible.
- Confirm submitting a request using an unverified or mismatched phone does NOT attach a portal profile.
- Confirm no real ID data and no unauthorized Lumen records appear.

## Privacy and Lumen limitations
- Only a user's own SMS-verified website profile is displayed. A phone number is not an ownership credential for historic Lumen records.
- The `portal_guest_lumen_links` table supports independently reviewed and verified links, but no live guest-scoped Lumen profile/history/rewards API is configured. **Do not** reuse the broad Lumen staff session in public endpoints.
- The legacy `reservations` schema is the Northwest 290 pilot intake. Other hotels must use hotel-scoped reservations and their own approved PMS mapping; do not present legacy booking UI as multi-property availability.
- The pilot does not create a Lumen guest or reservation from an incoming website request. Staff remains responsible for ID verification and check-in.
