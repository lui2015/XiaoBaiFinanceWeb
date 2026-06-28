import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';

export async function GET() {
  return apiHandler(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);
    const rows = await prisma.searchLog.groupBy({
      by: ['keyword'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { keyword: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: 10,
    });
    return jsonSafe(rows.map(r => ({ keyword: r.keyword, count: r._count.keyword })));
  });
}
