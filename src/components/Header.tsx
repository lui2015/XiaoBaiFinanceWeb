import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import HeaderNav from './HeaderNav';
import { jsonSafe } from '@/lib/api';

export default async function Header() {
  const [cats, user] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null, status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    getCurrentUser(),
  ]);
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-[1200px] px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-brand-500 font-bold text-xl">小白财经</span>
          <span className="hidden sm:inline text-xs text-gray-400">看得懂 · 找得到 · 读得顺</span>
        </Link>
        <HeaderNav
          categories={jsonSafe(cats)}
          user={user ? { id: String(user.id), nickname: user.nickname, avatarUrl: user.avatarUrl } : null}
        />
      </div>
    </header>
  );
}
