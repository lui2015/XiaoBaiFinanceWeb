import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return apiHandler(async () => {
    await requireAdmin();
    const all = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return jsonSafe(all);
  });
}

const schema = z.object({
  name: z.string().min(1).max(40),
  slug: z.string().min(1).max(60),
  parentId: z.string().regex(/^\d+$/).nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  iconUrl: z.string().url().optional(),
  description: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin();
    const body = schema.parse(await req.json().catch(() => ({})));
    const c = await prisma.category.create({
      data: {
        name: body.name, slug: body.slug,
        parentId: body.parentId ? Number(body.parentId) : null,
        sortOrder: body.sortOrder ?? 0,
        status: body.status ?? 1,
        iconUrl: body.iconUrl,
        description: body.description,
      },
    });
    return jsonSafe({ id: String(c.id) });
  });
}
