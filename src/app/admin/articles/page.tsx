import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ArticleListActions from './ArticleListActions';

export const dynamic = 'force-dynamic';

const STATUS = ['草稿', '已发布', '已下架'];

export default async function ArticleListPage({
  searchParams,
}: { searchParams: { page?: string; status?: string; keyword?: string } }) {
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 20;
  const where: any = { deletedAt: null };
  if (searchParams.status !== undefined && searchParams.status !== '') where.status = Number(searchParams.status);
  if (searchParams.keyword) where.title = { contains: searchParams.keyword };
  const [list, total] = await Promise.all([
    prisma.article.findMany({
      where, orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size,
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.article.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">文章管理</h1>
        <Link href="/admin/articles/new" className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">
          新建文章
        </Link>
      </div>

      <form className="bg-white p-3 rounded border border-gray-100 mb-3 flex flex-wrap gap-2 items-center">
        <input name="keyword" defaultValue={searchParams.keyword} placeholder="标题关键词"
          className="border border-gray-200 rounded px-2 py-1 text-sm" />
        <select name="status" defaultValue={searchParams.status || ''} className="border border-gray-200 rounded px-2 py-1 text-sm">
          <option value="">全部状态</option>
          <option value="0">草稿</option>
          <option value="1">已发布</option>
          <option value="2">已下架</option>
        </select>
        <button className="bg-gray-100 px-3 py-1 rounded text-sm">查询</button>
      </form>

      <div className="bg-white rounded border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left p-3">标题</th>
              <th className="text-left p-3">分类</th>
              <th className="text-left p-3">状态</th>
              <th className="text-right p-3">阅读 / 点赞 / 收藏</th>
              <th className="text-left p-3">发布时间</th>
              <th className="text-right p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => (
              <tr key={String(a.id)} className="border-t border-gray-100">
                <td className="p-3">
                  <Link className="hover:text-brand-500" href={`/admin/articles/${a.id}/edit`}>{a.title}</Link>
                  <div className="text-xs text-gray-400">/{a.slug}</div>
                </td>
                <td className="p-3">{a.category.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    a.status === 1 ? 'bg-emerald-50 text-emerald-600' :
                    a.status === 2 ? 'bg-gray-100 text-gray-500' :
                    'bg-amber-50 text-amber-600'}`}>{STATUS[a.status]}</span>
                  {a.scheduledAt && <span className="ml-2 text-xs text-brand-500">已定时</span>}
                </td>
                <td className="p-3 text-right text-xs">{a.viewCount} / {a.likeCount} / {a.favoriteCount}</td>
                <td className="p-3 text-xs text-gray-500">{a.publishAt ? new Date(a.publishAt).toLocaleString('zh-CN') : '-'}</td>
                <td className="p-3 text-right">
                  <ArticleListActions id={String(a.id)} status={a.status} slug={a.slug} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-1 mt-3">
        {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => {
          const p = i + 1;
          const q = new URLSearchParams({ page: String(p), ...(searchParams.status ? { status: searchParams.status } : {}), ...(searchParams.keyword ? { keyword: searchParams.keyword } : {}) }).toString();
          return (
            <Link key={p} href={`/admin/articles?${q}`}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200'}`}>
              {p}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
