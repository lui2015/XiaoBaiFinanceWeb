import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonSafe } from '@/lib/api';
import ArticleEditClient from './ArticleEditClient';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?returnTo=/me/manage/edit/${params.id}`);
  if (!u.isAdmin) redirect('/me');

  let article;
  try {
    article = await prisma.article.findFirst({
      where: { id: BigInt(params.id), deletedAt: null },
    });
  } catch {
    notFound();
  }
  if (!article) notFound();

  const cats = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, parentId: true, name: true, slug: true, sortOrder: true, status: true },
  });

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">编辑文章</h1>
        <Link href={`/article/${article.slug}`} className="text-sm text-brand-500">返回文章</Link>
      </div>
      <ArticleEditClient categories={jsonSafe(cats)} article={jsonSafe(article)} />
    </div>
  );
}
