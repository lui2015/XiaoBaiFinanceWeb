import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { slugify } from '@/lib/utils';

export async function GET() {
  return apiHandler(async () => {
    await requireManager();
    const all = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, parentId: true, name: true, slug: true, sortOrder: true, status: true },
    });
    return jsonSafe(all);
  });
}

const schema = z.object({
  name: z.string().min(1).max(40),
  parentId: z.string().regex(/^\d+$/).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

/** 生成唯一 slug */
async function uniqueSlug(name: string) {
  let base = slugify(name);
  let slug = base;
  let i = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const body = schema.parse(await req.json().catch(() => ({})));
    const slug = await uniqueSlug(body.name);
    const c = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        parentId: body.parentId ? BigInt(body.parentId) : null,
        sortOrder: body.sortOrder ?? 0,
        status: 1,
      },
    });
    return jsonSafe({ id: String(c.id) });
  });
}
