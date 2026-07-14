import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return apiHandler(async () => {
    await requireAdmin();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const [
      articleTotal, todayNewArticle, userTotal, todayNewUser,
      todayPv, topArticles, topKeywords, fbStats,
    ] = await Promise.all([
      prisma.article.count({ where: { deletedAt: null } }),
      prisma.article.count({ where: { deletedAt: null, createdAt: { gte: today0 } } }),
      prisma.user.count(),
      prisma.user.count({ where: { registeredAt: { gte: today0 } } }),
      prisma.articleViewLog.count({ where: { createdAt: { gte: today0 } } }),
      prisma.article.findMany({
        where: { deletedAt: null, status: 1 },
        orderBy: { viewCount: 'desc' }, take: 10,
        select: { id: true, title: true, slug: true, viewCount: true, likeCount: true, favoriteCount: true },
      }),
      prisma.searchLog.groupBy({
        by: ['keyword'],
        where: { createdAt: { gte: new Date(Date.now() - 7 * 86400 * 1000) } },
        _count: { keyword: true },
        orderBy: { _count: { keyword: 'desc' } },
        take: 10,
      }),
      prisma.userFeedback.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
    ]);
    return jsonSafe({
      articleTotal, todayNewArticle, userTotal, todayNewUser, todayPv,
      topArticles,
      topKeywords: topKeywords.map(k => ({ keyword: k.keyword, count: k._count.keyword })),
      feedbackStats: fbStats.map(f => ({ type: f.type, count: f._count.type })),
    });
  });
}
