import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { parsePage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const u = await requireUser();
    const { page, size } = parsePage(req.nextUrl.searchParams);
    const [list, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: 'desc' },
        take: size, skip: (page - 1) * size,
        include: { article: { select: { id: true, title: true, slug: true } } },
      }),
      prisma.userFeedback.count({ where: { userId: u.id } }),
    ]);
    return jsonSafe({ list, total, page, size });
  });
}
