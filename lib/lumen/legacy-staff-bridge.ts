/**
 * Crystal Inn single-property, read-only proof of concept against existing
 * Lumen staff endpoints. NOT a public website API and NOT a multi-tenant API.
 * Requires explicit operator authorization and separate least-privilege account.
 * Never import in client components, never expose returned staff/session data.
 */
import 'server-only';

const EXACT_HOST = 'lumenpms.com';
const PROPERTY_ID = 4;

type Session = { cookie: string; expiresAt: number };
let session: Session | undefined;
let loginPromise: Promise<Session> | undefined;

export function legacyBridgeConfigured(): boolean {
  return process.env.LUMEN_LEGACY_PILOT_ENABLED === 'true' &&
    Boolean(process.env.LUMEN_LEGACY_STAFF_EMAIL) &&
    Boolean(process.env.LUMEN_LEGACY_STAFF_PASSWORD) &&
    Boolean(process.env.LUMEN_PILOT_PREVIEW_TOKEN) &&
    (process.env.LUMEN_LEGACY_BASE_URL === 'https://lumenpms.com/' ||
      process.env.LUMEN_LEGACY_BASE_URL === 'https://lumenpms.com');
}

async function login(): Promise<Session> {
  const response = await fetch(`https://${EXACT_HOST}/api/UserAccount/SignIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      emailID: process.env.LUMEN_LEGACY_STAFF_EMAIL,
      password: process.env.LUMEN_LEGACY_STAFF_PASSWORD,
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Lumen sign-in failed.');
  // Only accept Lumen's known ASP.NET auth cookie, never forward arbitrary cookies.
  const values = response.headers.getSetCookie();
  const value = values.find(v => /^AppCookies=/i.test(v));
  const cookie = value?.split(';', 1)[0];
  if (!cookie || cookie.length > 10000) throw new Error('Lumen did not issue the expected staff cookie.');
  const result = { cookie, expiresAt: Date.now() + 8 * 60 * 1000 };
  // Confirm that the session is valid and scoped to the expected pilot hotel.
  const detail = await fetch(`https://${EXACT_HOST}/api/UserAccount/GetSignInUserDetail`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!detail.ok) throw new Error('Lumen session verification failed.');
  const account: unknown = await detail.json();
  if (!account || typeof account !== 'object' ||
      (account as { hotelID?: unknown }).hotelID !== PROPERTY_ID) {
    throw new Error('Lumen pilot account is not assigned to the expected hotel.');
  }
  return result;
}

async function authorizedSession(): Promise<Session> {
  if (session && Date.now() < session.expiresAt) return session;
  if (!loginPromise) loginPromise = login().finally(() => { loginPromise = undefined; });
  const fresh = await loginPromise;
  session = fresh;
  return fresh;
}

type InternalRoomType = {
  hotelRoomTypeID?: unknown;
  hotelID?: unknown;
  roomTypeName?: unknown;
  description?: unknown;
  isHotelRoomTypeActive?: unknown;
};

export async function previewLumenRoomTypes(): Promise<{ roomTypeId: number; name: string; description: string }[]> {
  if (!legacyBridgeConfigured()) throw new Error('Pilot bridge is disabled.');
  const active = await authorizedSession();
  // Endpoint is documented in feature_iteration11. Hardcoded read-only GET.
  const url = `https://${EXACT_HOST}/api/Hotel/GetHotelRoomType/${PROPERTY_ID}`;
  const response = await fetch(url, {
    headers: { Cookie: active.cookie, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) session = undefined;
  if (!response.ok) throw new Error('Unable to read Lumen room types.');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Unexpected Lumen response schema.');
  return payload.flatMap((room: InternalRoomType) => {
    if (!room || room.isHotelRoomTypeActive !== true ||
        room.hotelID !== PROPERTY_ID ||
        !Number.isSafeInteger(room.hotelRoomTypeID) ||
        typeof room.roomTypeName !== 'string') return [];
    return [{
      roomTypeId: room.hotelRoomTypeID as number,
      name: room.roomTypeName.slice(0, 100),
      description: typeof room.description === 'string' ? room.description.slice(0, 250) : '',
    }];
  });
}
