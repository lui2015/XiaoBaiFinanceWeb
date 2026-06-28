import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ArticleEditor from '../../ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const a = await prisma.article.findUnique({ where: { id: BigInt(params.id) } });
  if (!a) notFound();
  const cats = await prisma.category.findMany({ where: { status: 1 }, orderBy: { sortOrder: 'asc' } });
  const tree = cats.filter(c => !c.parentId).map(p => ({
    ...p, id: String(p.id),
    children: cats.filter(c => c.parentId === p.id).map(s => ({ ...s, id: String(s.id) })),
  }));
  return (
    <ArticleEditor
      mode="edit"
      categories={tree as any}
      initial={{
        id: String(a.id),
        title: a.title,
        slug: a.slug,
        summary: a.summary || '',
        sourceType: a.sourceType as 0 | 1 | 2,
        contentHtml: a.contentHtml,
        contentMd: a.contentMd || '',
        categoryId: String(a.categoryId),
        subCategoryId: a.subCategoryId ? String(a.subCategoryId) : '',
        coverUrl: a.coverUrl || '',
        isRecommend: a.isRecommend,
        status: a.status as 0 | 1 | 2,
        scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString().slice(0, 16) : '',
      }}
    />
  );
}
