import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import AdminLogout from './AdminLogout';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: '控制台' },
  { href: '/admin/articles', label: '文章管理' },
  { href: '/admin/categories', label: '分类管理' },
  { href: '/admin/users', label: '用户管理' },
  { href: '/admin/feedbacks', label: '反馈处理' },
  { href: '/admin/op-logs', label: '操作日志' },
  { href: '/admin/admins', label: '账号管理', minRole: 2 },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // /admin/login 单独处理
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminGuard>
        {(admin) => (
          <>
            <aside className="w-56 bg-[#0f172a] text-gray-200 flex-shrink-0 hidden md:flex flex-col">
              <div className="px-4 py-4 font-semibold text-base">小白财经 · 后台</div>
              <nav className="flex-1 flex flex-col">
                {NAV.filter(n => !n.minRole || admin.role >= n.minRole).map(n => (
                  <Link key={n.href} href={n.href} className="px-4 py-2 text-sm hover:bg-white/5">{n.label}</Link>
                ))}
              </nav>
              <div className="p-4 border-t border-white/10 text-xs">
                <div className="text-gray-400 mb-2">{admin.username} · {admin.role === 2 ? '超级管理员' : '管理员'}</div>
                <AdminLogout />
              </div>
            </aside>
            <div className="flex-1 min-w-0">
              <div className="bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between md:hidden">
                <span className="font-semibold">小白财经 · 后台</span>
                <span className="text-xs text-gray-500">{admin.username}</span>
              </div>
              <main className="p-4">{children}</main>
            </div>
          </>
        )}
      </AdminGuard>
    </div>
  );
}

async function AdminGuard({ children }: { children: (a: { id: string; username: string; role: number }) => React.ReactNode }) {
  const a = await getCurrentAdmin();
  if (!a) redirect('/admin/login');
  return <>{children({ id: String(a.id), username: a.username, role: a.role })}</>;
}
