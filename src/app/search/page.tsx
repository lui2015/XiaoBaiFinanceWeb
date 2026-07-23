import Link from 'next/link';
import { getSearch } from '@/lib/search';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: { searchParams: { keyword?: string; categoryId?: string; page?: string } }) {
  const keyword = (searchParams.keyword || '').trim();
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 15;

  let result: Awaited<ReturnType<ReturnType<typeof getSearch>['search']>> | null = null;
  if (keyword) {
    result = await getSearch().search({
      keyword,
      categoryId: searchParams.categoryId ? Number(searchParams.categoryId) : undefined,
      page, size,
    });
    prisma.searchLog.create({ data: { keyword, resultCount: result.total } }).catch(() => {});
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / size)) : 0;

  // 分类列表（用于筛选）
  const categories = await prisma.category.findMany({
    where: { status: 1, parentId: null }, orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <div className="bg-white p-4 rounded-lg border border-gray-100 mb-4">
        <form className="flex gap-2">
          <input
            name="keyword" defaultValue={keyword}
            placeholder="搜索财经知识..."
            className="flex-1 border border-gray-200 rounded px-3 py-2 outline-none focus:border-brand-500"
          />
          <button className="bg-brand-500 text-white px-4 rounded">搜索</button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3 text-sm">
          <Link href={keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search'}
            className={`px-3 py-1 rounded-full ${!searchParams.categoryId ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>全部分类</Link>
          {categories.map(c => (
            <Link key={String(c.id)}
              href={`/search?keyword=${encodeURIComponent(keyword)}&categoryId=${c.id}`}
              className={`px-3 py-1 rounded-full ${searchParams.categoryId === String(c.id) ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {!keyword ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">请输入关键词开始搜索</div>
      ) : result && result.total === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">
          没有找到与「{keyword}」相关的内容，换个关键词试试？
        </div>
      ) : result && (
        <>
          <div className="text-sm text-gray-500 mb-3">共 {result.total} 条结果</div>
          <div className="flex flex-col gap-3">
            {result.list.map((h) => (
              <Link key={h.id} href={`/article/${h.slug}`}
                className="bg-white p-4 rounded-lg border border-gray-100 hover:border-brand-500">
                <h3 className="font-semibold text-base hl"
                  dangerouslySetInnerHTML={{ __html: h.highlight?.title || h.title }} />
                {h.summary && (
                  <p className="text-sm text-gray-500 mt-1 hl"
                    dangerouslySetInnerHTML={{ __html: h.highlight?.content || h.summary }} />
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {h.publishAt ? new Date(h.publishAt).toLocaleDateString('zh-CN') : ''}
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => {
                const p = i + 1;
                const cat = searchParams.categoryId ? `&categoryId=${searchParams.categoryId}` : '';
                return (
                  <Link key={p} href={`/search?keyword=${encodeURIComponent(keyword)}&page=${p}${cat}`}
                    className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200'}`}>
                    {p}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
