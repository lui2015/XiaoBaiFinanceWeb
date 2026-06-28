import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST() {
  return apiHandler(async () => {
    const u = await requireUser();
    await prisma.user.update({
      where: { id: u.id },
      data: { status: 2, cancelAt: new Date(Date.now() + 7 * 86400 * 1000) },
    });
    return jsonSafe({ ok: true, finalizeAt: new Date(Date.now() + 7 * 86400 * 1000) });
  });
}
