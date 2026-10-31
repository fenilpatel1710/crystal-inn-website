# Per-hotel amenities and review system — migration 0011

## Product behavior
- **Hotel Admin → Amenities & Google** toggles thirteen property features, including breakfast, rewards, Wi-Fi and parking. All new flags default off; the existing `hotels.rewards_enabled` field remains the canonical Rewards participation setting.
- Public hotel directory shows a checkmark for offered core features and an empty box otherwise. The hotel detail **Overview** tab lists all feature flags with check/blank.
- **Hotel details → Guest reviews** shows two independent sources: the actual Google Maps star rating (if its Place ID/API are configured) and first-party Crystal Inn website reviews from that property's verified SMS guests.
- Google rating and total are retrieved server-to-server via Google Places API New; **not manually entered, not stored as local reviews, and not combined with website ratings**. The rating is always identified as `Google Maps`. No fake rating is shown when unavailable.
- A `Rate on Google` link uses the real Google Places `googleMapsLinks.writeAReviewUri` when API is enabled, otherwise the property's manually configured official Google write-review link. The Google reviews destination is separate from the website review submission.
- A verified Crystal Inn guest can leave **one** first-party review **only** for the hotel scoped to their authenticated session. Guests may update their own published review. They cannot reveal or post reviews for another hotel using a URL parameter. Phone verification is **not** evidence of a completed stay; do not mark these as `Verified Stay`.
- Reviews publish immediately, and Hotel Admin → Guest reviews can hide or restore each hotel's reviews. This is a basic moderation mechanism, not an entire abuse-detection or legal takedown workflow.

## Deployment prerequisites
1. Back up production Cloudflare D1 `crystal-inn-reservations`.
2. Ensure guest migrations 0009 and 0010 were installed (0010 adds the composite unique index on `portal_guest_users(id,hotel_id)`).
3. Run `migrations/0011_hotel_features_and_reviews.sql` in Cloudflare D1 **before merging/deploying**. It adds three tables only, without altering current reservations.
4. Confirm migration:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table'
     AND name IN ('hotel_features','hotel_google_profiles','hotel_guest_reviews');
   ```
   Expect three table rows.
5. Configure each property in Hotel Admin → Amenities & Google; defaults are deliberately off rather than assumed.
6. Optional for live Google ratings: create a Google Cloud project with **Places API (New)** and billing, restrict the server-side key to that API, and set Cloudflare Worker **secret** `GOOGLE_PLACES_API_KEY`. Never place this key in D1, source control or the browser. Supply each property's official Google Place ID. The API requests `rating,userRatingCount,googleMapsLinks,reviews` (up to five Google-authored reviews, with author attribution and original-review links). The `reviews` field can trigger a higher-billed Places SKU; monitor API quotas and costs. Google Maps attribution and author/source links must remain visible.
7. For the Google review button without the API key, provide the hotel's real Google write-review URL in Hotel Admin. Do not use a generic search link as a substitute for a write-review URL.
8. Test with two separate active hotels: enable only breakfast/Wi-Fi at Hotel A, only parking at Hotel B, confirm directory and property differences; sign in to A by SMS and submit a review; confirm the review appears only at A, and posting to B returns 403; hide A review via A's Hotel Admin and check it no longer appears publicly. Verify B's Hotel Admin cannot moderate A reviews.
9. Validate Google rating attribution and official outbound links. Follow Google Maps Platform terms, Places API attributions, billing and privacy requirements.

## Current limitations
- The website is still Next.js/Cloudflare, and Lumen PMS is **not connected** by this feature.
- First-party guest reviews confirm phone-account ownership, not a physical stay; a future verified-stay badge requires an approved hotel-scoped Lumen booking/guest link.
- Google ratings are a premium Google Places API field. Without a billed Places API key and Place ID, the page says rating unavailable, not a fabricated number.
- The public directory only shows the four prominent features by default; the property detail page lists all thirteen.
- The Google Places endpoint is queried on the hotel's reviews tab; configure strict Google Cloud quotas and billing alerts before enabling API access for production traffic, and respect Google's Places API caching policies. Displaying Google-sourced reviews also requires the proper attributions and Google privacy/terms notices.
