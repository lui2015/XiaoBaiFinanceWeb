import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';

export async function GET() {
  return apiHandler(async () => {
    const banners = await prisma.banner.findMany({
      where: { status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
    });
    return jsonSafe(banners);
  });
}
