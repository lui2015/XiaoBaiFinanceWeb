import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireOpenApiKey, recordOpenCall } from '@/lib/open-auth';
import { parsePage } from '@/lib/utils';

export const runtime = 'nodejs';

const querySchema = z.object({
  categoryId: z.string().regex(/^\d+$/).optional(),
  subCategoryId: z.string().regex(/^\d+$/).optional(),
  categorySlug: z.string().max(60).regex(/^[a-z0-9-]+$/).optional(),
  q: z.string().trim().max(50).optional(),
  sort: z.enum(['latest', 'hot']).optional(),
  recommend: z.enum(['0', '1']).optional(),
});

/** GET /api/open/v1/articles —— 已发布文章列表 */
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const ctx = await requireOpenApiKey(req);
    const sp = req.nextUrl.searchParams;
    const q = querySchema.parse({
      categoryId: sp.get('categoryId') || undefined,
      subCategoryId: sp.get('subCategoryId') || undefined,
      categorySlug: sp.get('categorySlug') || undefined,
      q: sp.get('q') || undefined,
      sort: sp.get('sort') || undefined,
      recommend: sp.get('recommend') || undefined,
    });
    const { page, size } = parsePage(sp);

    // 只暴露已发布且未删除的文章；所有条件均走 Prisma 参数绑定，不拼接 SQL
    const where: any = { status: 1, deletedAt: null };
    if (q.categoryId) where.categoryId = Number(q.categoryId);
    if (q.subCategoryId) where.subCategoryId = Number(q.subCategoryId);
    if (q.categorySlug) where.category = { slug: q.categorySlug, status: 1 };
    if (q.recommend === '1') where.isRecommend = true;
    if (q.q) where.OR = [{ title: { contains: q.q } }, { summary: { contains: q.q } }];

    const orderBy: any = q.sort === 'hot'
      ? [{ viewCount: 'desc' }, { id: 'desc' }]
      : [{ publishAt: 'desc' }, { id: 'desc' }];

    const [list, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        take: size,
        skip: (page - 1) * size,
        select: {
          id: true, title: true, slug: true, summary: true, coverUrl: true,
          sourceType: true, categoryId: true, subCategoryId: true,
          viewCount: true, likeCount: true, favoriteCount: true, isRecommend: true,
          publishAt: true, updatedAt: true,
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    await recordOpenCall(ctx);
    return jsonSafe({ list, total, page, size, hasMore: page * size < total });
  });
}
