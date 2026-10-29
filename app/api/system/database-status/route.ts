import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Minimal non-sensitive check of the production D1 binding.
 * This endpoint does not expose reservation or guest records.
 */
export async function GET() {
  try {
    const context = getCloudflareContext();
    const env = context.env as typeof context.env & {
      DB?: { prepare: (query: string) => { bind: (...values: string[]) => { first: <T>() => Promise<T | null> } } }
    };
    if (!env.DB) {
      return NextResponse.json({ database: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const result = await env.DB.prepare("SELECT value FROM schema_meta WHERE key = ?").bind('schema_version').first<{ value: string }>();
    if (result?.value !== '0001') {
      return NextResponse.json({ database: 'schema_not_ready' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ database: 'connected', schema: '0001' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ database: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
