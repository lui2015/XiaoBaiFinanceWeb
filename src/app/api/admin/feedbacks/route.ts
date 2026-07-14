import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { parsePage } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { page, size } = parsePage(sp);
    const status = sp.get('status');
    const type = sp.get('type');
    const where: any = {};
    if (status !== null && status !== '') where.status = Number(status);
    if (type !== null && type !== '') where.type = Number(type);
    const [list, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where, orderBy: { createdAt: 'desc' }, take: size, skip: (page - 1) * size,
        include: {
          article: { select: { id: true, title: true, slug: true } },
          user: { select: { id: true, nickname: true } },
        },
      }),
      prisma.userFeedback.count({ where }),
    ]);
    return jsonSafe({ list, total, page, size });
  });
}
