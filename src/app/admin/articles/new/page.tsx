import { prisma } from '@/lib/prisma';
import ArticleEditor from '../ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function NewArticlePage() {
  const cats = await prisma.category.findMany({ where: { status: 1 }, orderBy: { sortOrder: 'asc' } });
  const tree = cats.filter(c => !c.parentId).map(p => ({
    ...p, id: String(p.id),
    children: cats.filter(c => c.parentId === p.id).map(s => ({ ...s, id: String(s.id) })),
  }));
  return <ArticleEditor mode="create" categories={tree as any} />;
}
