import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonSafe } from '@/lib/api';
import ManageClient from './ManageClient';

export const dynamic = 'force-dynamic';

export default async function ManagePage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me/manage');
  if (!u.isAdmin) redirect('/me');

  const cats = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, parentId: true, name: true, slug: true, sortOrder: true, status: true },
  });
  const catsForClient = cats.map(c => ({ ...c, id: String(c.id), parentId: c.parentId ? String(c.parentId) : null }));

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">内容管理</h1>
        <Link href="/me" className="text-sm text-brand-500">返回个人中心</Link>
      </div>
      <ManageClient categories={jsonSafe(catsForClient)} />
    </div>
  );
}
