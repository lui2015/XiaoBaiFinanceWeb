import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';

export async function GET() {
  return apiHandler(async () => {
    const all = await prisma.category.findMany({
      where: { status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, iconUrl: true, sortOrder: true },
    });
    type Node = (typeof all)[number] & { children: Node[] };
    const map = new Map<string, Node>();
    all.forEach((c) => map.set(String(c.id), { ...c, children: [] }));
    const roots: Node[] = [];
    map.forEach((n) => {
      if (n.parentId) map.get(String(n.parentId))?.children.push(n);
      else roots.push(n);
    });
    return jsonSafe(roots);
  });
}
