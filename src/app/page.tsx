import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ArticleCard, { type ArticleCardItem } from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

// 生成带省略号的分页序列，如 [1, '...', 4, 5, 6, '...', 12]
function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const requested = Math.floor(Number(searchParams.page) || 1);
  const pageNum = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const [recommended, total, latest] = await Promise.all([
    // 今日精选：推荐位（最多 4 篇）
    prisma.article.findMany({
      where: { status: 1, deletedAt: null, isRecommend: true },
      orderBy: { publishAt: 'desc' },
      take: 4,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    // 最新发布总数
    prisma.article.count({ where: { status: 1, deletedAt: null } }),
    // 最新发布：按上传时间（createdAt）降序分页
    prisma.article.findMany({
      where: { status: 1, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(pageNum, totalPages);
  const pageItems = buildPageList(current, totalPages);

  const toCard = (a: any): ArticleCardItem => ({
    id: String(a.id), title: a.title, slug: a.slug, summary: a.summary,
    coverUrl: a.coverUrl, viewCount: a.viewCount, likeCount: a.likeCount,
    publishAt: a.createdAt, updatedAt: a.updatedAt,
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

        {/* 最新：头条大卡信息流（全量分页） */}
        <section>
          <h2 className="comic-title mb-4 flex items-center justify-between">
            <span className="comic-badge bg-sky text-ink">⚡ 最新发布</span>
            <span className="text-sm font-semibold text-ink/50">共 {total} 篇</span>
          </h2>

          {latest.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latest.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
            </div>
          ) : (
            <p className="text-ink/50 text-center py-16">暂无文章</p>
          )}

          {/* 分页控件 */}
          {totalPages > 1 && (
            <nav className="flex justify-center items-center gap-2 mt-10 flex-wrap" aria-label="分页">
              <Link
                href={current > 1 ? `/?page=${current - 1}` : '#'}
                aria-disabled={current <= 1}
                className={`comic-badge border-2 border-ink ${
                  current <= 1 ? 'opacity-40 pointer-events-none' : 'hover:bg-sunny'
                }`}
              >
                上一页
              </Link>

              {pageItems.map((it, idx) =>
                it === '...' ? (
                  <span key={`gap-${idx}`} className="px-2 text-ink/40 font-bold">…</span>
                ) : (
                  <Link
                    key={it}
                    href={`/?page=${it}`}
                    className={`comic-badge border-2 border-ink min-w-[36px] text-center ${
                      it === current ? 'bg-sky text-ink' : 'hover:bg-sunny'
                    }`}
                  >
                    {it}
                  </Link>
                )
              )}

              <Link
                href={current < totalPages ? `/?page=${current + 1}` : '#'}
                aria-disabled={current >= totalPages}
                className={`comic-badge border-2 border-ink ${
                  current >= totalPages ? 'opacity-40 pointer-events-none' : 'hover:bg-sunny'
                }`}
              >
                下一页
              </Link>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
