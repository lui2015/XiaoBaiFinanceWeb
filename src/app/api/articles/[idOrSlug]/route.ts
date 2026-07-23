import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { buildToc } from '@/lib/sanitize';

export async function GET(_req: NextRequest, { params }: { params: { idOrSlug: string } }) {
  return apiHandler(async () => {
    const { idOrSlug } = params;
    const isNumeric = /^\d+$/.test(idOrSlug);
    const a = await prisma.article.findFirst({
      where: {
        ...(isNumeric ? { id: Number(idOrSlug) } : { slug: idOrSlug }),
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!a) throw ApiErrors.notFound('文章不存在');
    if (a.status !== 1) throw ApiErrors.notFound('文章未发布');

    const { html, toc } = buildToc(a.contentHtml);
    // 上一篇 / 下一篇（同分类）
    const [prevArt, nextArt] = await Promise.all([
      prisma.article.findFirst({
        where: { categoryId: a.categoryId, status: 1, deletedAt: null, id: { lt: a.id } },
        orderBy: { id: 'desc' }, select: { id: true, title: true, slug: true },
      }),
      prisma.article.findFirst({
        where: { categoryId: a.categoryId, status: 1, deletedAt: null, id: { gt: a.id } },
        orderBy: { id: 'asc' }, select: { id: true, title: true, slug: true },
      }),
    ]);
    const related = await prisma.article.findMany({
      where: { categoryId: a.categoryId, status: 1, deletedAt: null, NOT: { id: a.id } },
      orderBy: { publishAt: 'desc' }, take: 4,
      select: { id: true, title: true, slug: true, summary: true, coverUrl: true },
    });

    return jsonSafe({
      article: {
        id: a.id, title: a.title, slug: a.slug, summary: a.summary,
        contentHtml: html, sourceType: a.sourceType,
        coverUrl: a.coverUrl, viewCount: a.viewCount, likeCount: a.likeCount,
        favoriteCount: a.favoriteCount, publishAt: a.publishAt, updatedAt: a.updatedAt,
        category: a.category, subCategory: a.subCategory,
        tags: a.tags.map(t => ({ id: t.tagId, name: t.tag.name, slug: t.tag.slug })),
      },
      toc,
      prev: prevArt, next: nextArt, related,
    });
  });
}
