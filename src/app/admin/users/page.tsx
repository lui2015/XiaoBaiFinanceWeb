import { prisma } from '@/lib/prisma';
import UserListActions from './UserListActions';

export const dynamic = 'force-dynamic';

const STATUS = ['正常', '已封禁', '注销中', '已注销'];

export default async function UsersPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 30;
  const where: any = {};
  if (searchParams.status !== undefined && searchParams.status !== '') where.status = Number(searchParams.status);
  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size,
      select: {
        id: true, nickname: true, phoneMasked: true, emailMasked: true,
        status: true, registeredAt: true, lastLoginAt: true, lastLoginIp: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">用户管理</h1>
        <span className="text-sm text-gray-500">共 {total} 人</span>
      </div>
      <div className="bg-white rounded border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left p-3">昵称</th>
              <th className="text-left p-3">手机</th>
              <th className="text-left p-3">邮箱</th>
              <th className="text-left p-3">状态</th>
              <th className="text-left p-3">注册时间</th>
              <th className="text-left p-3">最后登录</th>
              <th className="text-right p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => (
              <tr key={String(u.id)} className="border-t border-gray-100">
                <td className="p-3">{u.nickname}</td>
                <td className="p-3 text-gray-500">{u.phoneMasked || '-'}</td>
                <td className="p-3 text-gray-500">{u.emailMasked || '-'}</td>
                <td className="p-3">{STATUS[u.status]}</td>
                <td className="p-3 text-xs text-gray-500">{new Date(u.registeredAt).toLocaleString('zh-CN')}</td>
                <td className="p-3 text-xs text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN') : '-'}</td>
                <td className="p-3 text-right">
                  <UserListActions id={String(u.id)} status={u.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
