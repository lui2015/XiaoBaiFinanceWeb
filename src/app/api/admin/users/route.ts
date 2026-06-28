import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { parsePage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { page, size } = parsePage(sp);
    const status = sp.get('status');
    const where: any = {};
    if (status !== null && status !== '') where.status = Number(status);
    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where, orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size,
        select: {
          id: true, nickname: true, avatarUrl: true,
          phoneMasked: true, emailMasked: true, status: true,
          registeredAt: true, lastLoginAt: true, lastLoginIp: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return jsonSafe({ list, total, page, size });
  });
}
