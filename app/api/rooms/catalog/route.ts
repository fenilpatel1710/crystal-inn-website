import { NextResponse } from 'next/server';
import { isLumenConfigured, lumenRead, LumenNotConfiguredError } from '../../../../lib/lumen/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoomTypeFromLumen = {
  roomTypeId?: unknown;
  name?: unknown;
  description?: unknown;
  maxOccupancy?: unknown;
};

export async function GET() {
  if (!isLumenConfigured()) {
    return NextResponse.json({ status: 'unavailable', message: 'Live room catalog integration is not enabled.' }, { status: 503 });
  }
  try {
    // Expected schema for proposed dedicated Lumen integration endpoint.
    // No staff API response is forwarded to the guest browser.
    const data = await lumenRead<unknown>('room-types');
    if (!Array.isArray(data)) throw new Error('Unexpected catalog schema');
    const rooms = (data as RoomTypeFromLumen[]).map((room) => ({
      roomTypeId: typeof room.roomTypeId === 'number' ? room.roomTypeId : null,
      name: typeof room.name === 'string' ? room.name.slice(0, 100) : '',
      description: typeof room.description === 'string' ? room.description.slice(0, 500) : '',
      maxOccupancy: typeof room.maxOccupancy === 'number' ? room.maxOccupancy : null,
    })).filter(room => room.roomTypeId !== null && room.name);
    return NextResponse.json({ rooms }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof LumenNotConfiguredError ? 503 : 502;
    return NextResponse.json({ status: 'unavailable', message: 'Live room catalog is temporarily unavailable.' }, { status: code, headers: { 'Cache-Control': 'no-store' } });
  }
}
