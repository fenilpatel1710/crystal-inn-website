# Contact inquiries and Google Maps ratings — Crystal Inn Hotels & Stays

## Contact Crystal Inn form: route and delivery

The public `/contact` form always saves a validated inquiry to the existing Cloudflare D1 `guest_inquiries` table. It is visible at **Super Admin → Guest Inquiries**. The caller receives an inquiry reference whether or not email is available, plus a warning when notification has not been accepted.

Recipient logic:
- **Hotel selected:** send through the established Google Workspace Gmail API sender (`reservations@crystalinnstay.com`) to that property's `hotel_reservation_settings.booking_notification_email` if set. Otherwise use `hotels.public_email`. If neither is set, fall back to the central address.
- **General inquiry:** send through the same Gmail API to the centrally configured `platform_settings.contact_email`, editable at **Super Admin → Settings → Central inquiries email**. The original 0005 migration populated `frontdesk@crystalinnstay.com` by default; confirm that mailbox is actively monitored, or change it using the Settings page. The code's fallback only applies if no row exists and uses `reservations@crystalinnstay.com`.
- **Property manager:** view inquiries specifically submitted for their hotel in **Hotel Admin → Guest inquiries**. A hotel's login cannot list another property's inquiries.
- The guest's email is set as **Reply-To**, not as the sender. The sending mailbox and OAuth credentials remain unchanged in Cloudflare.

No Resend request is used by `/api/public/inquiries` anymore. The endpoint uses the existing `sendGoogleWorkspaceMail` helper and existing Cloudflare secrets.
Google Gmail acceptance is **not** inbox-delivery verification; bounced/spam/non-delivery and pending requests require operational review. There is currently no automatic retry queue for contact inquiries. Inspect `reservations@crystalinnstay.com` Sent when a guest reports no response. The D1 inquiry remains in Super Admin for manual follow-up.

No D1 migration is needed. Existing guest inquiry rows remain available. The new hotel-scoped inbox is read-only, and Super Admin remains responsible for marking statuses as new / in_progress / resolved.

## Google rating diagnosis (does not affect email)

The **public Guest reviews** tab has two *separate* sources: Crystal Inn website reviews stored in D1, and the official Google Maps tile populated only from Places API (New). A saved Google Maps review URL is insufficient to fetch Google ratings.

1. Open **Google Cloud Console** in the project where billing is enabled. Activate **Places API (New)**.
2. Create a Places API (New) server key restricted to that service. Store as encrypted `GOOGLE_PLACES_API_KEY` in the production Cloudflare Worker `crystal-inn-website`. Never put that value in a public page, Google Workspace OAuth variables or GitHub.
3. Sign in to **Hotel Admin → Amenities & Google** for the exact hotel. Check the key and Place ID indicators. Use **Find this hotel on Google Maps**, match the correct name and exact property address, select it, and click **Save amenities and Google settings**.
4. Click **Test live Google rating** (new) after saving. This performs an authenticated, on-demand `rating,userRatingCount` request, explains 403 (key/billing/API restrictions), 404 (wrong Place ID), 429 (quota), missing Place ID/key, or returns Google's actual rating.
5. Visit the public hotel's **Guest reviews** tab again. It already makes a Place Details (New) request for `rating,userRatingCount,googleMapsLinks,reviews`. Google may return up to five selected reviews. This is *not* a complete historical listing of all Google reviews; the website will link to Google for the full set.

Google Places billing: rating and userRatingCount are **Place Details Enterprise**; fetching review text is **Enterprise + Atmosphere**. The public tab currently requests reviews as well as rating, so set API budgets and review Google Maps Platform billing and display/attribution terms. Source: https://developers.google.com/maps/documentation/places/web-service/place-details

**Limitations:** We cannot assert live Google rating delivery unless the production Place ID, key, billing, and Cloudflare deployment have been verified. The new diagnostic does not automatically configure the key or save Place IDs. Live Map iframe ratings do not authorize the website to read or copy ratings from the iframe.
