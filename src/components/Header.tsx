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
  const categories = cats.map(c => ({ ...c, id: String(c.id) }));
  return (
    <header className="bg-cream border-b-2 border-ink sticky top-0 z-30">
      <div className="mx-auto max-w-[1200px] px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-sunny border-2 border-ink shadow-comic-sm text-lg font-black group-hover:animate-wiggle">白</span>
          <span className="flex flex-col leading-none">
            <span className="text-ink font-black text-lg tracking-tight">小白财经</span>
            <span className="hidden sm:inline text-[11px] text-ink/50 font-semibold mt-0.5">看得懂 · 找得到 · 读得顺</span>
          </span>
        </Link>
        <HeaderNav
          categories={jsonSafe(categories)}
          user={user ? { id: String(user.id), nickname: user.nickname, avatarUrl: user.avatarUrl, isAdmin: !!user.isAdmin } : null}
        />
      </div>
    </header>
  );
}
