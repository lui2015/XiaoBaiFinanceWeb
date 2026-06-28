import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const me = await getCurrentAdmin();
  if (!me || me.role < 2) redirect('/admin');
  const list = await prisma.adminUser.findMany({
    select: { id: true, username: true, role: true, status: true, realName: true, lastLoginAt: true, lastLoginIp: true },
    orderBy: { id: 'asc' },
  });
  return (
    <AdminClient
      list={list.map(a => ({
        ...a, id: String(a.id),
        lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
      }))}
    />
  );
}
