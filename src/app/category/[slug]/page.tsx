import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ArticleCard, { type ArticleCardItem } from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function CategoryPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { sub?: string; page?: string; sort?: string };
}) {
  const slug = decodeSlug(params.slug);
  const cat = await prisma.category.findUnique({
    where: { slug },
    include: { children: { where: { status: 1 }, orderBy: { sortOrder: 'asc' } } },
  });
  if (!cat || cat.status !== 1) notFound();

  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 15;
  const sort = (searchParams.sort === 'hot' ? 'hot' : 'latest') as 'latest' | 'hot';

  const where: any = { status: 1, deletedAt: null, categoryId: cat.id };
  if (searchParams.sub) {
    const sub = await prisma.category.findUnique({ where: { slug: decodeSlug(searchParams.sub) } });
    if (sub && sub.parentId === cat.id) where.subCategoryId = sub.id;
  }
  const [list, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: sort === 'hot' ? [{ viewCount: 'desc' }] : [{ publishAt: 'desc' }, { id: 'desc' }],
      take: size, skip: (page - 1) * size,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.article.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / size));

  const toCard = (a: any): ArticleCardItem => ({
    id: String(a.id), title: a.title, slug: a.slug, summary: a.summary,
    coverUrl: a.coverUrl, viewCount: a.viewCount, likeCount: a.likeCount,
    publishAt: a.publishAt,
    category: a.category ? { id: String(a.category.id), name: a.category.name, slug: a.category.slug } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-brand-500">首页</Link>
        <span className="mx-1">/</span>
        <span>{cat.name}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-2">{cat.name}</h1>
      {cat.description && <p className="text-sm text-gray-500 mb-4">{cat.description}</p>}

      {cat.children.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Link href={`/category/${cat.slug}`}
            className={`px-3 py-1 rounded-full text-sm ${!searchParams.sub ? 'bg-brand-500 text-white' : 'bg-gray-100 hover:bg-brand-50'}`}>
            全部
          </Link>
          {cat.children.map(s => (
            <Link key={String(s.id)} href={`/category/${cat.slug}?sub=${s.slug}`}
              className={`px-3 py-1 rounded-full text-sm ${searchParams.sub === s.slug ? 'bg-brand-500 text-white' : 'bg-gray-100 hover:bg-brand-50'}`}>
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-3 text-sm">
        <Link href={`/category/${cat.slug}?${searchParams.sub ? `sub=${searchParams.sub}&` : ''}sort=latest`}
          className={`px-3 py-1 ${sort === 'latest' ? 'text-brand-500 font-semibold' : 'text-gray-500'}`}>最新</Link>
        <Link href={`/category/${cat.slug}?${searchParams.sub ? `sub=${searchParams.sub}&` : ''}sort=hot`}
          className={`px-3 py-1 ${sort === 'hot' ? 'text-brand-500 font-semibold' : 'text-gray-500'}`}>最热</Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">暂无文章</div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(a => <ArticleCard key={String(a.id)} a={toCard(a)} />)}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => {
            const p = i + 1;
            const sub = searchParams.sub ? `&sub=${searchParams.sub}` : '';
            return (
              <Link key={p} href={`/category/${cat.slug}?page=${p}${sub}&sort=${sort}`}
                className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200'}`}>
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
