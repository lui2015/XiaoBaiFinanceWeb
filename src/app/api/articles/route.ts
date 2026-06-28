import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { parsePage } from '@/lib/utils';

const querySchema = z.object({
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  recommend: z.enum(['0', '1']).optional(),
  sort: z.enum(['latest', 'hot']).optional(),
});

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const sp = req.nextUrl.searchParams;
    const q = querySchema.parse({
      categoryId: sp.get('categoryId') || undefined,
      subCategoryId: sp.get('subCategoryId') || undefined,
      recommend: sp.get('recommend') || undefined,
      sort: sp.get('sort') || undefined,
    });
    const { page, size } = parsePage(sp);
    const where: any = { status: 1, deletedAt: null };
    if (q.categoryId) where.categoryId = BigInt(q.categoryId);
    if (q.subCategoryId) where.subCategoryId = BigInt(q.subCategoryId);
    if (q.recommend === '1') where.isRecommend = true;
    const orderBy = q.sort === 'hot' ? [{ viewCount: 'desc' as const }] : [{ publishAt: 'desc' as const }, { id: 'desc' as const }];
    const [list, total] = await Promise.all([
      prisma.article.findMany({
        where, orderBy, take: size, skip: (page - 1) * size,
        select: {
          id: true, title: true, slug: true, summary: true, coverUrl: true,
          categoryId: true, subCategoryId: true, viewCount: true, likeCount: true,
          favoriteCount: true, publishAt: true, isRecommend: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.article.count({ where }),
    ]);
    if (page > 1 && list.length === 0) throw ApiErrors.notFound('页码超出范围');
    return jsonSafe({ list, total, page, size });
  });
}
