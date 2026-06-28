import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { writeOpLog } from '@/lib/op-log';
import { getClientIp } from '@/lib/utils';

const schema = z.object({ status: z.union([z.literal(0), z.literal(1)]) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const { status } = schema.parse(await req.json().catch(() => ({})));
    const id = BigInt(params.id);
    await prisma.user.update({ where: { id }, data: { status } });
    if (status === 1) {
      await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
    }
    await writeOpLog({ adminId: admin.id, action: 'user.status', targetType: 'user', targetId: id, payload: { status }, ip: getClientIp(req) });
    return jsonSafe({ ok: true });
  });
}
