# Firebase guest phone authentication — Crystal Inn

## Scope and current behavior

This migration replaces **Twilio Verify only for guest sign-in**. It does **not** replace hotel reservation notification SMS, the hotel phone numbers, or authorized Lumen integrations.

- The login page switches to Firebase only when `GUEST_AUTH_PROVIDER=firebase` is configured.
- Guests select a hotel, submit a US mobile number, complete a visible Firebase reCAPTCHA challenge, receive a one-time Firebase SMS, and enter their code.
- The web client sends its Firebase **ID token**, never the SMS code, to `/api/guest/auth/firebase/session`.
- The backend verifies the token's Google certificate signature, issuer, project ID, sign-in provider, fresh phone-auth time, and phone number. It creates the existing hotel-scoped D1 session cookie.
- Existing hotel-scoped `portal_guest_users` records match **only a verified phone number and hotel**; this does not assert PMS/Lumen identity. Government-issued ID stays a **front-desk** process.
- The existing Twilio routes return HTTP 410 when Firebase is selected so they cannot be used to bypass the switchover.
- No migration to guest database schema is required if migrations 0009 and 0010 are already in place.

## Firebase Console setup (owner action)

1. Visit https://console.firebase.google.com/ and create or select your Crystal Inn Firebase project. Enable the **Blaze** pay-as-you-go plan for SMS.
2. Authentication → Sign-in method → enable **Phone**.
3. Authentication → Settings → SMS region policy: **allow only United States** initially. For new projects the default may deny all regions.
4. Authentication → Settings → Authorized domains: add `crystalinnstay.com` (and `www.crystalinnstay.com` if used). Add any Cloudflare preview hostname only if you trust it. Localhost is not an approved production phone-auth domain.
5. Project settings → Your apps → add a **Web** app. Copy **API key**, **authDomain**, **projectId**, **appId** (these are client app identifiers, not service-account private keys).
6. Authentication → Settings → abuse prevention: review Firebase SMS quotas and usage. Set Cloud Billing **budget alerts**. Budget alerts are not guaranteed hard caps. Add test phone numbers for development to avoid charges.
7. Confirm the account's SMS terms, phone-number consent and privacy wording before launching.

## Cloudflare Worker settings (server variables)

In Cloudflare Workers → `crystal-inn-website` → Settings → Variables and Secrets:

| Setting | Value |
| --- | --- |
| `GUEST_AUTH_PROVIDER` | `firebase` (only after testing) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_API_KEY` | Firebase Web app API key |
| `FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `FIREBASE_APP_ID` | Firebase Web app ID |
| `GUEST_AUTH_PEPPER` | Keep existing random secret (32+ chars) |
| `DB` | Keep existing D1 binding |

Do **not** upload Firebase Admin service account JSON or secret private keys to the repository.

Deploy the validated PR to production; then flip `GUEST_AUTH_PROVIDER` to `firebase` and disable `GUEST_OTP_ENABLED` to stop use of Twilio for login. Keep existing Twilio config only if still needed for separate messaging integrations.

## Test before launch

1. On a restricted preview domain authorized in Firebase, enable Firebase env vars with project settings.
2. Check that new guest phone verification requests show reCAPTCHA, complete test-code login, and set the `ci_guest_session` HttpOnly secure cookie.
3. Verify existing guest phone logs in to the same **selected hotel** record and another hotel's guest account remains isolated.
4. Verify `/api/guest/me` and `/api/guest/logout` work unchanged, and returning guests can use an unexpired session without another SMS.
5. Confirm invalid/expired/wrong-project ID tokens fail, and Firebase-sign-in is blocked when unconfigured.
6. Confirm three preflight requests per hour per hotel/number, IP limits, and Firebase SMS quota. **Note:** client preflight cannot prevent a hostile script from contacting Firebase directly; use Google SMS policies and domain/reCAPTCHA protections. For stronger cloud-side abuse controls, review Firebase App Check / enterprise protection as appropriate.
7. Confirm reservation requests and Lumen links are unchanged; verify ID only at the front desk.

## Known limits

Firebase SMS is **billed per SMS sent**, even if the code is never verified. The first ten daily messages may be excluded from billing under the current project pricing. Costs vary by destination. Our preflight limits control **our application flow**, but cannot impose a hard limit on Google's Firebase API calls. Use Firebase's regional restrictions and quotas. Do not imply a phone number is proof of a guest's legal identity.

This change does **not** provision a Firebase project, turn on SMS, configure Google Cloud billing, or deploy the live site automatically.
