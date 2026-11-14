import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireOpenApiKey, recordOpenCall } from '@/lib/open-auth';

export const runtime = 'nodejs';

/** GET /api/open/v1/categories —— 启用中的分类树 */
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const ctx = await requireOpenApiKey(req);
    const all = await prisma.category.findMany({
      where: { status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true, name: true, slug: true, parentId: true,
        iconUrl: true, description: true, sortOrder: true,
      },
    });

    type Node = (typeof all)[number] & { children: Node[] };
    const map = new Map<string, Node>();
    all.forEach((c) => map.set(String(c.id), { ...c, children: [] }));
    const roots: Node[] = [];
    map.forEach((n) => {
      if (n.parentId) map.get(String(n.parentId))?.children.push(n);
      else roots.push(n);
    });

    await recordOpenCall(ctx);
    return jsonSafe({ list: roots, total: all.length });
  });
}
