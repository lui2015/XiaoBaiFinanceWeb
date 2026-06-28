import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ArticleCard, { type ArticleCardItem } from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [recommended, latest, categories, hotKeywords] = await Promise.all([
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
    prisma.category.findMany({
      where: { status: 1, parentId: null },
      orderBy: [{ sortOrder: 'asc' }],
    }),
    prisma.searchLog.groupBy({
      by: ['keyword'],
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400 * 1000) } },
      _count: { keyword: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: 8,
    }),
  ]);

  const toCard = (a: any): ArticleCardItem => ({
    id: String(a.id), title: a.title, slug: a.slug, summary: a.summary,
    coverUrl: a.coverUrl, viewCount: a.viewCount, likeCount: a.likeCount,
    publishAt: a.publishAt,
    category: a.category ? { id: String(a.category.id), name: a.category.name, slug: a.category.slug } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        {/* Banner */}
        <section className="bg-gradient-to-r from-brand-500 to-brand-700 text-white rounded-xl p-6 sm:p-10 mb-6">
          <h1 className="text-xl sm:text-3xl font-bold mb-2">看得懂的财经知识</h1>
          <p className="text-brand-100 text-sm sm:text-base">
            从基础概念到基本面、技术面、宏观经济、投资品种、理财规划——为财经小白准备的体系化知识库。
          </p>
        </section>

        {/* 分类入口 */}
        <section className="mb-6">
          <h2 className="font-semibold text-lg mb-3">分类导航</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {categories.map(c => (
              <Link
                key={String(c.id)}
                href={`/category/${c.slug}`}
                className="bg-white border border-gray-100 rounded-lg p-3 text-center text-sm hover:border-brand-500 hover:text-brand-500 transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>

        {/* 推荐 */}
        {recommended.length > 0 && (
          <section className="mb-6">
            <h2 className="font-semibold text-lg mb-3">推荐阅读</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommended.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
            </div>
          </section>
        )}

        {/* 最新 */}
        <section>
          <h2 className="font-semibold text-lg mb-3">最新文章</h2>
          <div className="flex flex-col gap-3">
            {latest.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
          </div>
        </section>
      </div>

      {/* 侧栏（移动端隐藏） */}
      <aside className="hidden lg:block space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <h3 className="font-semibold mb-3">热门搜索</h3>
          {hotKeywords.length === 0 ? (
            <div className="text-sm text-gray-400">暂无搜索记录</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hotKeywords.map((k) => (
                <Link key={k.keyword} href={`/search?keyword=${encodeURIComponent(k.keyword)}`}
                  className="px-3 py-1 bg-gray-100 rounded-full text-xs hover:bg-brand-50 hover:text-brand-500">
                  {k.keyword}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 text-xs text-gray-500 leading-6">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">免责声明</h3>
          本站内容仅作学习参考，不构成任何投资建议。投资有风险，决策需谨慎。
        </div>
      </aside>
    </div>
  );
}
