import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function OpLogsPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page || 1));
  const size = 30;
  const list = await prisma.operationLog.findMany({
    orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size,
  });
  return (
    <div>
      <h1 className="text-lg font-semibold mb-3">操作日志</h1>
      <div className="bg-white rounded border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left p-3">时间</th>
              <th className="text-left p-3">管理员</th>
              <th className="text-left p-3">动作</th>
              <th className="text-left p-3">目标</th>
              <th className="text-left p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {list.map(l => (
              <tr key={String(l.id)} className="border-t border-gray-100">
                <td className="p-3 text-xs text-gray-500">{new Date(l.createdAt).toLocaleString('zh-CN')}</td>
                <td className="p-3">{l.adminId ? String(l.adminId) : '-'}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3 text-xs">{l.targetType}: {l.targetId}</td>
                <td className="p-3 text-xs text-gray-500">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
