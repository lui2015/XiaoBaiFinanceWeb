import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { parsePage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin(2);
    const sp = req.nextUrl.searchParams;
    const { page, size } = parsePage(sp);
    const adminId = sp.get('adminId');
    const action = sp.get('action');
    const where: any = {};
    if (adminId) where.adminId = BigInt(adminId);
    if (action) where.action = action;
    const [list, total] = await Promise.all([
      prisma.operationLog.findMany({ where, orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size }),
      prisma.operationLog.count({ where }),
    ]);
    return jsonSafe({ list, total, page, size });
  });
}
