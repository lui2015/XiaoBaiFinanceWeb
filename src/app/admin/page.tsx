import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const [
    articleTotal, todayNewArticle, userTotal, todayNewUser, todayPv,
    topArticles, topKeywords, fbStats,
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

  const stats = [
    { label: '文章总数', value: articleTotal },
    { label: '今日新增文章', value: todayNewArticle },
    { label: '注册用户', value: userTotal },
    { label: '今日新增用户', value: todayNewUser },
    { label: '今日浏览', value: todayPv },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-4 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <h3 className="font-semibold mb-3">热门文章 TOP 10</h3>
          <table className="w-full text-sm">
            <thead className="text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="text-left py-2">标题</th>
                <th className="text-right">阅读</th>
                <th className="text-right">点赞</th>
                <th className="text-right">收藏</th>
              </tr>
            </thead>
            <tbody>
              {topArticles.map(a => (
                <tr key={String(a.id)} className="border-b border-gray-50">
                  <td className="py-2 truncate max-w-[300px]">{a.title}</td>
                  <td className="text-right">{a.viewCount}</td>
                  <td className="text-right">{a.likeCount}</td>
                  <td className="text-right">{a.favoriteCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <h3 className="font-semibold mb-3">7 天热搜词 TOP 10</h3>
          {topKeywords.length === 0 ? (
            <div className="text-sm text-gray-400">暂无</div>
          ) : (
            <ol className="text-sm space-y-1">
              {topKeywords.map((k, i) => (
                <li key={k.keyword} className="flex justify-between">
                  <span><span className="text-gray-400 mr-2">{i + 1}.</span>{k.keyword}</span>
                  <span className="text-gray-500">{k._count.keyword}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-100">
        <h3 className="font-semibold mb-3">反馈统计</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[['有用', 0], ['没用', 1], ['报错', 2]].map(([label, v]) => {
            const cnt = fbStats.find(f => f.type === v)?._count.type || 0;
            return (
              <div key={String(label)} className="border border-gray-100 rounded p-3">
                <div className="text-2xl font-semibold">{cnt}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
