import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { requireOpenApiKey, recordOpenCall } from '@/lib/open-auth';

export const runtime = 'nodejs';

const ID_OR_SLUG_RE = /^[a-zA-Z0-9\u4e00-\u9fa5_-]{1,80}$/;

/** GET /api/open/v1/articles/{idOrSlug} —— 文章详情（含正文） */
export async function GET(req: NextRequest, { params }: { params: { idOrSlug: string } }) {
  return apiHandler(async () => {
    const ctx = await requireOpenApiKey(req);
    const { idOrSlug } = params;
    if (!ID_OR_SLUG_RE.test(idOrSlug)) throw ApiErrors.badRequest('idOrSlug 格式不正确');

    const a = await prisma.article.findFirst({
      where: {
        ...(/^\d+$/.test(idOrSlug) ? { id: Number(idOrSlug) } : { slug: idOrSlug }),
        status: 1,
        deletedAt: null,
      },
      select: {
        id: true, title: true, slug: true, summary: true, coverUrl: true, sourceType: true,
        contentHtml: true, contentText: true, contentMd: true,
        categoryId: true, subCategoryId: true,
        viewCount: true, likeCount: true, favoriteCount: true, isRecommend: true,
        publishAt: true, createdAt: true, updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!a) throw ApiErrors.notFound('文章不存在或未发布');

    await recordOpenCall(ctx);
    return jsonSafe({
      article: { ...a, tags: a.tags.map((t) => t.tag) },
      url: `/XiaoBaiFinance/article/${a.slug}`,
    });
  });
}
