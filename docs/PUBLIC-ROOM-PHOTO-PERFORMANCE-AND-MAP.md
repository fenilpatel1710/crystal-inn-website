# Crystal Inn — Public hotel room gallery and interactive location map

## Guest-facing changes

- **Rooms:** One large room photo per card; **transparent left/right arrows** appear over that image only for room types with 2 or more images. No "1 of 1" thumbnails or redundant thumbnails are downloaded.
- **View photo:** Opens a larger image on demand. A 1-photo room only displays its photo and View photo control, not pointless carousel arrows.
- **Load performance:** Each card loads only its current photo, lazily and asynchronously. The public R2 media endpoint accepts controlled `?w=360|720|1600` variants. The card requests a **720px WebP** via the existing **Cloudflare Images** binding; the lightbox requests a **1600px WebP**. Original R2 images remain intact. The server uses a public edge cache after confirming the gallery entry, active hotel and room, and active media asset in D1. Cache storage is best-effort; unavailable cache or Images binding gracefully falls back to public original stream.
- **Location & contact:** A Google Maps tile appears **on the individual public property page**, not just Hotel Admin. Both share the same `HotelMapTile`, including visible **+ / − zoom buttons**, map dragging and a link to open full Google Maps. It uses the property's stored address, never defaults to an arbitrary city-center pin.

## How to check

1. Deploy the merged `main` commit to production in Cloudflare Workers Builds.
2. Open `/hotels/northwest-290` → **Rooms**. A room with 1 photo should not show any numbered thumbnail strip or arrow. A room with multiple assigned images should display two translucent arrows; click them to view different photos without navigating away.
3. In browser DevTools → Network, check that each card requests **one** `/api/public/media/room?...&w=720` image rather than both image and thumbnail. The response should be `image/webp` when Cloudflare Images binding is available. The large `w=1600` image should be fetched only after selecting View photo.
4. Reopen the Rooms tab and confirm photos come from browser or edge caching. Verify rooms with no photo show a placeholder.
5. Open **Location & contact**. Check map pin is at the correct hotel address (Northwest 290 currently shows 6850 Gessner Rd) and use + / − to adjust zoom. Check on mobile as well.
6. Check the same zoom controls on **Hotel Admin**.
7. Do not assume latency is solved until tested in the live Cloudflare Worker. Compare actual encoded WebP response sizes with legacy original; savings vary by source image.

## Operations and costs

- Uses existing `IMAGES` and `HOTEL_MEDIA` bindings in `wrangler.jsonc`. No database migrations and no new API credentials. The Cloudflare Images binding incurs image-transformation usage under the account plan; review quota/pricing and caching if gallery traffic grows.
- Cache headers allow up to 15 minutes in the browser and up to one hour on shared caches. Each Worker media request verifies the active public D1 gallery assignment before serving an edge-cache hit; browser caches are independent.
- Legacy room image URLs are kept as-is and are not automatically resized. To get fast room image variants, upload/assign photos through the managed R2 gallery.
- This does not alter photo assignments or uploaded originals, and it does not affect booking, reviews, OTP or email.
