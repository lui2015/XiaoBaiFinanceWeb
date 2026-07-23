import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { writeOpLog } from '@/lib/op-log';
import { getClientIp } from '@/lib/utils';

const schema = z.object({ status: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const { status } = schema.parse(await req.json().catch(() => ({})));
    const id = Number(params.id);
    await prisma.userFeedback.update({
      where: { id },
      data: { status, handlerId: admin.id, handledAt: new Date() },
    });
    await writeOpLog({ adminId: admin.id, action: 'feedback.status', targetType: 'feedback', targetId: id, payload: { status }, ip: getClientIp(req) });
    return jsonSafe({ ok: true });
  });
}
