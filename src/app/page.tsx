import { prisma } from '@/lib/prisma';
import ArticleCard, { type ArticleCardItem } from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [recommended, latest] = await Promise.all([
    prisma.article.findMany({
      where: { status: 1, deletedAt: null, isRecommend: true },
      orderBy: { publishAt: 'desc' },
      take: 4,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.article.findMany({
      where: { status: 1, deletedAt: null },
      orderBy: { publishAt: 'desc' },
      take: 10,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
  ]);

  const toCard = (a: any): ArticleCardItem => ({
    id: String(a.id), title: a.title, slug: a.slug, summary: a.summary,
    coverUrl: a.coverUrl, viewCount: a.viewCount, likeCount: a.likeCount,
    publishAt: a.publishAt,
    category: a.category ? { id: String(a.category.id), name: a.category.name, slug: a.category.slug } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div>
        {/* 推荐：今日精选大卡 */}
        {recommended.length > 0 && (
          <section className="mb-8">
            <h2 className="comic-title mb-4">
              <span className="comic-badge bg-coral text-white">🔥 今日精选</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommended.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
            </div>
          </section>
        )}

        {/* 最新：头条大卡信息流 */}
        <section>
          <h2 className="comic-title mb-4">
            <span className="comic-badge bg-sky text-ink">⚡ 最新发布</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latest.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
