# Crystal Inn pilot: no Lumen code changes

**Status:** pilot integration code committed to website repository, **OFF by default**. This is NOT a production connection and does not require rebuilding/redeploying Lumen.

## Design
The Next.js server calls Lumen's pre-existing APIs (feature_iteration11 source):
- POST `/api/UserAccount/SignIn` (username/password, sets AppCookies session)
- GET `/api/UserAccount/GetSignInUserDetail` (verify pilot account belongs to HotelID=4)
- GET `/api/Hotel/GetHotelRoomType/4` (read room types only)

It converts the result to three fields: `roomTypeId`, `name`, and `description`.
No guest information, internal room numbers, bookings, payments, staff account data, or cookies are returned.

**Protected testing endpoint:** `GET /api/internal/lumen/room-types`, header `x-lumen-preview-token` required; does not serve public website visitors. The feature fails closed when disabled. The current website public room catalog endpoint remains unchanged and disabled pending a dedicated public integration API.

## Operational setup (Vercel; server env vars only)
1. Obtain written/operational authorization from the Lumen owner/admin. Create a **dedicated pilot staff user restricted to Crystal Inn**, ideally read-only (note: current Lumen roles may not enforce read-only scope). Never use a SuperAdmin or normal front-desk account. If a least-privilege identity cannot be provisioned, DO NOT enable pilot.
2. Remediate Lumen's existing critical password reset vulnerability and rotate exposed credentials before activating any automated session. This may require the PMS vendor to update Lumen; if source/deploy must remain untouched, leave the pilot disabled until vendor confirms mitigation.
3. Vercel Project → Settings → Environment Variables, add `LUMEN_LEGACY_PILOT_ENABLED=true`, `LUMEN_LEGACY_BASE_URL=https://lumenpms.com/`, `LUMEN_LEGACY_STAFF_EMAIL`, `LUMEN_LEGACY_STAFF_PASSWORD` and `LUMEN_PILOT_PREVIEW_TOKEN` (cryptographically random >=32 characters). Only set in preview/staging first. Do NOT use NEXT_PUBLIC_ variables.
4. Deploy the website (not Lumen) and check a protected request with an API tool using `x-lumen-preview-token`; never put this token in a browser URL, client JavaScript, or shared screenshots.
5. Check that a wrong/missing preview token is denied; that an invalid staff account cannot connect; that a hotel other than ID 4 is rejected; that data is sanitized; and that no PMS errors reveal private data.
6. When testing is finished, disable `LUMEN_LEGACY_PILOT_ENABLED` and rotate pilot credentials if exposed.

## Limitations
- This proof of concept uses a staff cookie **only on the server** and assumes Lumen's `SignIn` endpoint responds with `AppCookies`. It requires live testing to confirm the deployed server's Set-Cookie behavior.
- Session cache is in-memory and best-effort per server instance. Vercel may run multiple instances and may need repeated logins; limit pilot testing frequency. A persistent separate bridge with controlled session management is recommended if repeated calls become necessary.
- Existing Lumen hotel ID checks are not known to be complete. The bridge checks the logged-in user's HotelID but this is only a defense in depth; it does not replace Lumen's tenant authorization.
- Read-only room metadata only; do not enable guest data, date-based public inventory, payment or bookings until security has been independently addressed.
- The public website is unchanged; no live booking was enabled.
