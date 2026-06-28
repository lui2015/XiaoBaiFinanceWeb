import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MyHistoryPage({ searchParams }: { searchParams: { page?: string } }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me/history');
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 20;
  const [list, total] = await Promise.all([
    prisma.userHistory.findMany({
      where: { userId: u.id },
      orderBy: { viewedAt: 'desc' },
      take: size, skip: (page - 1) * size,
      include: { article: { select: { id: true, title: true, slug: true } } },
    }),
    prisma.userHistory.count({ where: { userId: u.id } }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">浏览历史（{total}）</h1>
      {list.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">还没有浏览记录</div>
      ) : (
        <div className="flex flex-col">
          {list.map(({ article: a, viewedAt }) => (
            <Link key={String(a.id)} href={`/article/${a.slug}`}
              className="bg-white p-3 border-b border-gray-100 hover:bg-gray-50 flex justify-between items-center">
              <span className="text-sm truncate">{a.title}</span>
              <span className="text-xs text-gray-400 ml-3 shrink-0">{new Date(viewedAt).toLocaleString('zh-CN')}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
