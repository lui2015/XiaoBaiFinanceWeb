import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET() {
  return apiHandler(async () => {
    const u = await requireUser();
    return jsonSafe({
      id: String(u.id),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      phoneMasked: u.phoneMasked,
      emailMasked: u.emailMasked,
      registeredAt: u.registeredAt,
      lastLoginAt: u.lastLoginAt,
    });
  });
}

const updateSchema = z.object({
  nickname: z.string().min(2).max(20).optional(),
  avatarUrl: z.string().url().max(255).optional(),
});

export async function PUT(req: Request) {
  return apiHandler(async () => {
    const u = await requireUser();
    const body = updateSchema.parse(await req.json().catch(() => ({})));
    const updated = await prisma.user.update({ where: { id: u.id }, data: body });
    return jsonSafe({ id: String(updated.id), nickname: updated.nickname, avatarUrl: updated.avatarUrl });
  });
}
