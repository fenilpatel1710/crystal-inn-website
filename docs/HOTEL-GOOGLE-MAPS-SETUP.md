# Crystal Inn Hotel Admin — Google Maps locations and reviews

## What this update does
- A map card appears on **every hotel's Hotel Admin dashboard**, below the reservation/room/rate summary.
- The map uses only the logged-in hotel's **saved street address** under **Hotel details**. It is not a city-centre placeholder and it never mixes the addresses of two hotels.
- Google Maps itself provides zoom-in, zoom-out, pan and satellite controls in the embedded view (subject to Google's iframe UI).
- A **View/Open in Google Maps** link opens the hotel's matching Place ID, if one has been saved. The embedded map uses the hotel's actual saved street address.
- **Amenities & Google → Find this hotel on Google Maps** lets hotel staff look up the real Google listing and select it, without manually finding its Place ID.
- Search results include hotel name, Google-provided address and a Google Maps verification link; the manager must confirm the correct property before choosing. The selected Place ID and Google review URL populate the existing form, but **do not save until Save amenities and Google settings is clicked**.
- The Google review link comes from Google's `googleMapsLinks.writeAReviewUri` when available; otherwise the Google Maps listing page is used. Avoid old Google Travel search URLs as direct review links.
- Live Google stars/reviews still require the Places API key. Ratings are never invented or manually entered.

## Setup — once per Google Cloud project
1. In **Google Cloud Console**, use a project with a Google Maps Platform billing account. Search for and **enable Places API (New)**. This is separate from Gmail API and Google Workspace authorization.
2. Create an API key restricted to the Places API (New) service. Because the API calls originate from the Cloudflare Worker, **do not expose this secret in `NEXT_PUBLIC_` variables or add it to source control**. Cloudflare Workers often have variable outbound egress IPs; configure application restrictions according to your backend's actual supported network identity and Google's guidance. Use API restrictions, least privilege, quotas, usage monitoring and billing alerts.
3. In Cloudflare **Workers & Pages → crystal-inn-website → Settings → Variables and Secrets**, store:
   ```text
   GOOGLE_PLACES_API_KEY=<encrypted Google Maps Platform server-side key>
   ```
4. Save/apply the production Worker configuration. Do not change the existing Google Workspace Gmail API credentials.
5. In **Hotel Admin → Hotel details**, verify each property's full street address. Save if needed.
6. In **Hotel Admin → Amenities & Google**, click **Find this hotel on Google Maps**, verify the business identity and address, choose **Use this listing**, and then **Save amenities and Google settings**.
7. Reload the dashboard. The Google Maps card should show the saved property address with an interactive map. Visit the public property's **Guest reviews** tab to see the real Google rating/reviews once the Places key and verified Place ID are in place.

## Privacy, security, and operating notes
- Only the authenticated hotel administrator can search for the hotel bound to their own login and choose a listing. The server reads the hotel name and address directly from its own D1 record, not an arbitrary search string supplied by the browser.
- Google Places calls happen server-side and never expose the API key to the browser.
- The map iframe is a Google Maps embed of the hotel's saved **street address**, so the manager should inspect the marker and correct the address if Google pinning is inaccurate. The map does **not** automatically validate street address correctness or prove the Place ID is the same location.
- Without a saved full street address, the map shows an honest placeholder instead of a potentially misleading city-wide pin.
- Google Maps Platform API requests can incur usage charges. Embedding a simple Google Maps search map does not require the Places API key, but Google controls iframe availability and interactive controls.
- No D1 migration is necessary. Uses the existing hotel `address_text` and `hotel_google_profiles` columns and the existing authenticated Hotel Admin API.
- Google Places API search and rating/review responses are subject to Google's terms, usage restrictions and available fields. Do not treat the top search result as automatically verified.

## Public hotel address and one external Maps link (November 2026)

- **Public hotel → Location & contact → Find Us** displays the formatted full mailing address (street, city, state, and ZIP when saved). For Northwest 290 only, the existing stored street address `6850 Gessner Rd` is completed with its published `Houston, TX 77040` ZIP; this is a temporary explicit fallback, not a guess for other properties.
- **Public hotel → Google Maps tile:** the duplicate website-owned "Open in Google Maps" link in the tile header has been removed. The single website-controlled external Maps link remains in the **Find Us** card. Google's **native "Open in Maps"** control inside the embedded iframe is managed by Google and cannot be removed through the website safely.
- **Hotel Admin map:** still has its own "Open in Google Maps" link, because it appears on the separate manager dashboard and has no public Find Us card.
- Future hotels should save their complete street mailing address with ZIP under **Hotel Admin → Hotel details**. The shared formatter avoids repeating the city/state if already in the saved address.

## Getting live Google star ratings on the public Reviews tile

The public tile already fetches Google ratings via `GET /api/public/hotels/[slug]/google`, using a server-only Places API (New) request. Gmail OAuth is completely separate and cannot access Maps ratings.

1. Open <https://console.cloud.google.com/> under the appropriate Google Cloud project.
2. Enable **Places API (New)** with an active **Google Maps Platform billing account**.
3. Create a distinct **Places API (New)-restricted** API key. In production Cloudflare Worker `crystal-inn-website` → **Settings → Variables and Secrets**, save `GOOGLE_PLACES_API_KEY` as an encrypted secret. Do not paste keys into hotel admin, Gmail variables, GitHub, or guest-facing code.
4. Open **Hotel Admin → Amenities & Google**. The setup indicator shows whether a key is detected and a Place ID is entered. Click **Find this hotel on Google Maps**, confirm the correct Google business listing by name and address, select it, and click **Save amenities and Google settings**. A Google Travel search link is not a substitute for a Place ID.
5. Open **Public hotel → Guest reviews** to test that the Google rating and total Google ratings count show on their **own** tile; hotel website reviews remain separately rated.
6. If the rating stays unavailable, verify the configured Place ID and Google Cloud billing/API activation/key restriction. Google may return a denied or empty rating for an invalid or incorrect Place ID, or if the Google API key is invalid. The admin "key detected" flag is not a verified successful API call.

**Costs:** Place Details (New) with `rating,userRatingCount` belongs to Google's Enterprise SKU; requesting `reviews` for recent review text can trigger the costlier Enterprise + Atmosphere SKU. The existing integration requests both rating and reviews, so enable budgets/alerts and review pricing and data-refresh requirements before rolling out to many properties. Source: <https://developers.google.com/maps/documentation/places/web-service/place-details> and <https://developers.google.com/maps/documentation/places/web-service/get-api-key>.
