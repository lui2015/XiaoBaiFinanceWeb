import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const FB_TYPE = ['有用', '没用', '报错'];
const FB_STATUS = ['待处理', '已采纳', '已修复', '已关闭'];

export default async function MyFeedbacksPage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me/feedbacks');
  const list = await prisma.userFeedback.findMany({
    where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50,
    include: { article: { select: { id: true, title: true, slug: true } } },
  });
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">我的反馈</h1>
      {list.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400">还没有反馈记录</div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((f) => (
            <div key={String(f.id)} className="bg-white p-4 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-500">{FB_TYPE[f.type]}</span>
                <span className="text-xs text-brand-500">{FB_STATUS[f.status]}</span>
              </div>
              <Link href={`/article/${f.article.slug}`} className="text-sm font-medium hover:text-brand-500">
                {f.article.title}
              </Link>
              {f.content && <p className="text-sm text-gray-500 mt-2 whitespace-pre-line">{f.content}</p>}
              <div className="text-xs text-gray-400 mt-2">{new Date(f.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
