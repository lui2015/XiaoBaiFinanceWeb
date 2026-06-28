import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(1).max(40).optional(),
  sortOrder: z.number().int().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  iconUrl: z.string().url().optional(),
  description: z.string().max(255).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAdmin();
    const body = schema.parse(await req.json().catch(() => ({})));
    await prisma.category.update({ where: { id: BigInt(params.id) }, data: body });
    return jsonSafe({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAdmin(2);
    const id = BigInt(params.id);
    const cnt = await prisma.article.count({ where: { OR: [{ categoryId: id }, { subCategoryId: id }] } });
    if (cnt > 0) throw ApiErrors.conflict('该分类下仍有文章，无法删除');
    await prisma.category.delete({ where: { id } });
    return jsonSafe({ ok: true });
  });
}
