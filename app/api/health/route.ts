import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/health — 200 { ok: true, db: 'up' } when MongoDB answers a ping, otherwise 503 { ok: false, db: 'down' }.
// Never reveals why (no error text, host or URI).
export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    if (mongoose.connection.readyState !== 1) throw new Error('not connected');
    return json({ ok: true, db: 'up' });
  } catch (error) {
    console.error(`[health] database check failed: ${(error as { name?: string })?.name ?? 'Error'}`);
    return json({ ok: false, db: 'down' }, 503);
  }
}
