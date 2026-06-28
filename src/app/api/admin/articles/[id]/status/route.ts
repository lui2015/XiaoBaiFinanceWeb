import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { writeOpLog } from '@/lib/op-log';
import { getClientIp } from '@/lib/utils';
import { getSearch } from '@/lib/search';

const schema = z.object({ status: z.union([z.literal(0), z.literal(1), z.literal(2)]) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const id = BigInt(params.id);
    const { status } = schema.parse(await req.json().catch(() => ({})));
    const a = await prisma.article.update({
      where: { id },
      data: {
        status,
        publishAt: status === 1 ? new Date() : undefined,
      },
    });
    if (status === 1) await getSearch().upsertArticle(id);
    else await getSearch().removeArticle(id);
    await writeOpLog({ adminId: admin.id, action: 'article.status', targetType: 'article', targetId: id, payload: { status }, ip: getClientIp(req) });
    return jsonSafe({ id: String(a.id), status: a.status });
  });
}
