import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { legacyBridgeConfigured, previewLumenRoomTypes } from '../../../../../lib/lumen/legacy-staff-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, private' };

function previewAuthorized(request: NextRequest): boolean {
  const expected = process.env.LUMEN_PILOT_PREVIEW_TOKEN || '';
  const provided = request.headers.get('x-lumen-preview-token') || '';
  if (expected.length < 32 || provided.length !== expected.length || provided.length > 4096) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function GET(request: NextRequest) {
  if (!legacyBridgeConfigured()) {
    return NextResponse.json({ message: 'Pilot integration disabled.' }, { status: 503, headers });
  }
  if (!previewAuthorized(request)) {
    return NextResponse.json({ message: 'Not found.' }, { status: 404, headers });
  }
  try {
    return NextResponse.json({ propertyId: 4, roomTypes: await previewLumenRoomTypes(), source: 'lumen-pilot' }, { headers });
  } catch {
    // Upstream details could contain private operational information: never return them.
    return NextResponse.json({ message: 'Pilot Lumen connection unavailable.' }, { status: 502, headers });
  }
}
