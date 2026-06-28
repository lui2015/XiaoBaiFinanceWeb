import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MyFavoritesPage({ searchParams }: { searchParams: { page?: string } }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me/favorites');
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 15;
  const [list, total] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: size, skip: (page - 1) * size,
      include: { article: { include: { category: { select: { id: true, name: true, slug: true } } } } },
    }),
    prisma.userFavorite.count({ where: { userId: u.id } }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">我的收藏（{total}）</h1>
      {list.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">还没有收藏的文章</div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(({ article: a }) => (
            <Link key={String(a.id)} href={`/article/${a.slug}`}
              className="bg-white p-4 rounded-lg border border-gray-100 hover:border-brand-500">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{a.summary}</p>
              <div className="text-xs text-gray-400 mt-2">{a.category.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
