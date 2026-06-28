import { prisma } from '@/lib/prisma';
import CategoryClient from './CategoryClient';

export const dynamic = 'force-dynamic';

export default async function CategoryAdminPage() {
  const all = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  const tree = all.filter(c => !c.parentId).map(p => ({
    id: String(p.id), name: p.name, slug: p.slug, status: p.status, sortOrder: p.sortOrder,
    children: all.filter(c => c.parentId === p.id).map(s => ({ id: String(s.id), name: s.name, slug: s.slug, status: s.status, sortOrder: s.sortOrder })),
  }));
  return <CategoryClient initial={tree} />;
}
