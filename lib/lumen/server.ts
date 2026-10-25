/**
 * Lumen server-to-server transport. This module must never be imported by
 * client components. Do not reuse Lumen staff sign-in or browser cookies.
 *
 * The integration API and X-Api-Key authentication are PROPOSED contracts:
 * they do not exist in the supplied feature_iteration11 PMS code yet.
 */
import 'server-only';

export class LumenNotConfiguredError extends Error {
  constructor() { super('The approved Lumen integration is not configured.'); this.name = 'LumenNotConfiguredError'; }
}

export class LumenUpstreamError extends Error {
  constructor(message: string) { super(message); this.name = 'LumenUpstreamError'; }
}

function configuration(): { base: URL; key: string; hotelId: string } {
  const url = process.env.LUMEN_INTEGRATION_BASE_URL;
  const key = process.env.LUMEN_INTEGRATION_API_KEY;
  const hotelId = process.env.LUMEN_HOTEL_UNIQUE_ID;
  if (!url || !key || !hotelId || process.env.LUMEN_INTEGRATION_ENABLED !== 'true') {
    throw new LumenNotConfiguredError();
  }
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new LumenNotConfiguredError();
  }
  // Explicit allowlist prevents accidental requests to untrusted hosts.
  const approved = (process.env.LUMEN_INTEGRATION_ALLOWED_HOST || '').toLowerCase();
  if (!approved || base.hostname.toLowerCase() !== approved) throw new LumenNotConfiguredError();
  if (!/^[0-9a-f-]{36}$/i.test(hotelId)) throw new LumenNotConfiguredError();
  return { base, key, hotelId };
}

export function isLumenConfigured(): boolean {
  try { configuration(); return true; } catch { return false; }
}

export async function lumenRead<T>(resource: string): Promise<T> {
  const { base, key, hotelId } = configuration();
  // Only allow future dedicated public-integration API paths, never staff APIs.
  if (!/^room-types$/.test(resource)) throw new LumenUpstreamError('Resource is not approved for this integration.');
  const target = new URL('api/public/v1/hotels/' + encodeURIComponent(hotelId) + '/' + resource, base);
  if (target.origin !== base.origin) throw new LumenUpstreamError('Unsafe integration URL.');
  let response: Response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new LumenUpstreamError('Unable to reach the Lumen integration API.');
  }
  if (!response.ok) throw new LumenUpstreamError('Lumen integration API returned an error.');
  return (await response.json()) as T;
}
