import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import LogoutButton from './LogoutButton';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me');
  const [favCount, historyCount, fbCount] = await Promise.all([
    prisma.userFavorite.count({ where: { userId: u.id } }),
    prisma.userHistory.count({ where: { userId: u.id } }),
    prisma.userFeedback.count({ where: { userId: u.id } }),
  ]);

  return (
    <div className="mx-auto max-w-[800px] px-4 py-6">
      <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 mb-4">
        {u.avatarUrl
          ? <img src={u.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          : <div className="w-16 h-16 rounded-full bg-brand-500 text-white text-xl flex items-center justify-center">{u.nickname.slice(0,1)}</div>}
        <div className="flex-1">
          <div className="font-semibold text-lg">{u.nickname}</div>
          <div className="text-xs text-gray-400">{u.phoneMasked || u.emailMasked || '未绑定'}</div>
        </div>
        <Link href="/me/settings" className="text-sm text-brand-500">设置</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/me/favorites" className="bg-white rounded-lg p-4 border border-gray-100 text-center hover:border-brand-500">
          <div className="text-2xl font-bold">{favCount}</div>
          <div className="text-sm text-gray-500 mt-1">我的收藏</div>
        </Link>
        <Link href="/me/history" className="bg-white rounded-lg p-4 border border-gray-100 text-center hover:border-brand-500">
          <div className="text-2xl font-bold">{historyCount}</div>
          <div className="text-sm text-gray-500 mt-1">浏览历史</div>
        </Link>
        <Link href="/me/feedbacks" className="bg-white rounded-lg p-4 border border-gray-100 text-center hover:border-brand-500">
          <div className="text-2xl font-bold">{fbCount}</div>
          <div className="text-sm text-gray-500 mt-1">我的反馈</div>
        </Link>
      </div>

      <div className="mt-6"><LogoutButton /></div>
    </div>
  );
}
