# Work from home — Crystal Inn + Lumen PMS integration

**Updated:** October 25, 2026  
**Pilot scope:** Crystal Inn NW/290 only (Lumen `HotelID = 4`).  
**Current status:** Source and documentation are committed. Pilot connectivity is **not live**, **not tested against Lumen**, and **disabled by default**. Existing Lumen source and production deployment have **not been modified**.

## Start here

1. Open [Crystal Inn website GitHub](https://github.com/fenilpatel1710/crystal-inn-website).
2. Click **Code → Download ZIP** to obtain this repository, or clone it:
   ```bash
   git clone https://github.com/fenilpatel1710/crystal-inn-website.git
   cd crystal-inn-website
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`. This runs the existing **demo website only**. SMS OTP, guest data, payments and reservations are **not** connected.
4. Review [No-touch pilot guide](./lumen-no-touch-pilot.md), [Phase 1 foundation](./lumen-phase1-integration.md), and [API discovery](./lumen-api-integration-discovery.md).
5. Run `npm run build` to check the website before committing or deploying changes. The build has **not** been independently verified in this chat.

## Important files

| Path | Description |
| --- | --- |
| `app/page.tsx` | Existing Crystal Inn website and demo guest portal |
| `lib/lumen/legacy-staff-bridge.ts` | Single-hotel read-only staff-session bridge, **off by default** |
| `app/api/internal/lumen/room-types/route.ts` | Protected pilot test endpoint |
| `lib/lumen/server.ts` | Future native/public API transport, **off by default** |
| `app/api/rooms/catalog/route.ts` | Future public-safe room catalog endpoint, currently returns 503 |
| `.env.example` | Placeholder configuration keys only; **no real secrets** |
| `LumenPMS (CheckinPro) — Website Integration Brief.md` | Extensive architecture/API/security brief |
| `CheckinPro-feature_iteration11.zip` | Feature Iteration 11 source snapshot (see security warning below) |
| `CheckinPro-master.zip` | Older, incomplete starter source archive |
| `docs/lumen-no-touch-pilot.md` | Conditions, config, test plan for existing-Lumen pilot |

## What the current pilot does

Under explicit operator authorization, a restricted **server-side** pilot connects to Lumen's existing staff API:
- `POST /api/UserAccount/SignIn` → `AppCookies` session
- `GET /api/UserAccount/GetSignInUserDetail` → confirm HotelID 4
- `GET /api/Hotel/GetHotelRoomType/4` → internally read room types
- `GET /api/internal/lumen/room-types` (website side) → return only approved room-type ID, name, description, and no staff cookie or guest records

**This is a temporary testing approach, not a production multi-hotel integration.** Existing PMS authorization may not isolate hotels adequately. The login flow, cookie parsing, live endpoint response and Vercel deployment remain unverified.

## Security blocker — read before enabling anything

**This GitHub repository is currently PUBLIC and contains a copy of CheckinPro source.** The Lumen integration brief reports that the original source included active-looking SMTP credentials and SQL Server connection details. We have **not validated whether those values remain usable**; treat them as exposed and rotate/revoke them immediately. Merely deleting the ZIP in a new commit will not erase it from Git history.

Action for repository/PMS administrators:
1. Restrict source/archive access: move sensitive PMS code to a **private GitHub repository**; remove exposed archives from the public site and address historic git exposure through GitHub's documented sensitive-data removal process.
2. Rotate/revoke all potentially exposed SMTP/SQL credentials and inspect audit logs for misuse.
3. Have the Lumen owner/developer assess and remediate the security vulnerabilities identified in the integration brief, including password reset, OTP validation, tenant authorization and unprotected scanner endpoints.
4. Do not create or enable any staff-session bridge until a dedicated least-privilege account is approved, security issues are addressed, and staged tests pass.
5. **Never commit real passwords, cookies, API keys, guest records, database backups or production `.env` files.**

## Next action when security prerequisites are met

Configure pilot-only secrets as Vercel server-side environment variables (never `NEXT_PUBLIC_`):
- `LUMEN_LEGACY_PILOT_ENABLED`
- `LUMEN_LEGACY_BASE_URL`
- `LUMEN_LEGACY_STAFF_EMAIL`
- `LUMEN_LEGACY_STAFF_PASSWORD`
- `LUMEN_PILOT_PREVIEW_TOKEN`

See [the no-touch pilot guide](./lumen-no-touch-pilot.md) for prerequisites and validation. No real credentials have been added by ChatGPT.

## Product roadmap

1. **Single-hotel read-only pilot** — verify Lumen connection for Crystal Inn, no live guest data or booking.
2. **Date-based room availability & rates** — validated, server-scoped and sanitized.
3. **Public reservations, payments, guest identity and rewards** — only after security review, transaction locking, and approved service access.
4. **Multi-hotel platform** — later, once single-hotel pilot is stable; no need to onboard multiple properties now.

## Deployment notes

Website: Next.js on Vercel; new commits on `main` may trigger an automatic build. Lumen: unchanged. GitHub commits are **not evidence** of a successful deployment or API connection. Verify the deployment in Vercel before relying on it.
