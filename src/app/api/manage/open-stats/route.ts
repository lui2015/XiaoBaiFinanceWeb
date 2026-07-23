import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { readStats, todayKey } from '@/lib/openStats';

export async function GET(_req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const stats = await readStats();
    const day = todayKey();
    return {
      total: stats.total || 0,
      today: stats.daily?.[day] || 0,
    };
  });
}
