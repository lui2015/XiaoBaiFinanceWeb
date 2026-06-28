import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import FeedbackActions from './FeedbackActions';

export const dynamic = 'force-dynamic';
const TYPE = ['有用', '没用', '报错'];
const STATUS = ['待处理', '已采纳', '已修复', '已关闭'];

export default async function FeedbacksPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  const where: any = {};
  if (searchParams.status !== undefined && searchParams.status !== '') where.status = Number(searchParams.status);
  if (searchParams.type !== undefined && searchParams.type !== '') where.type = Number(searchParams.type);
  const list = await prisma.userFeedback.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { article: { select: { id: true, title: true, slug: true } }, user: { select: { id: true, nickname: true } } },
  });
  return (
    <div>
      <h1 className="text-lg font-semibold mb-3">反馈处理</h1>
      <form className="bg-white p-3 rounded border border-gray-100 mb-3 flex gap-2">
        <select name="status" defaultValue={searchParams.status || ''} className="border border-gray-200 rounded px-2 py-1 text-sm">
          <option value="">全部状态</option>
          <option value="0">待处理</option>
          <option value="1">已采纳</option>
          <option value="2">已修复</option>
          <option value="3">已关闭</option>
        </select>
        <select name="type" defaultValue={searchParams.type || ''} className="border border-gray-200 rounded px-2 py-1 text-sm">
          <option value="">全部类型</option>
          <option value="0">有用</option>
          <option value="1">没用</option>
          <option value="2">报错</option>
        </select>
        <button className="bg-gray-100 px-3 py-1 rounded text-sm">查询</button>
      </form>
      <div className="bg-white rounded border border-gray-100">
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left p-3">类型</th>
              <th className="text-left p-3">文章</th>
              <th className="text-left p-3">用户</th>
              <th className="text-left p-3">内容</th>
              <th className="text-left p-3">状态</th>
              <th className="text-left p-3">时间</th>
              <th className="text-right p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(f => (
              <tr key={String(f.id)} className="border-t border-gray-100">
                <td className="p-3">{TYPE[f.type]}</td>
                <td className="p-3">
                  <Link href={`/article/${f.article.slug}`} target="_blank" className="text-brand-500 hover:underline">{f.article.title}</Link>
                </td>
                <td className="p-3">{f.user.nickname}</td>
                <td className="p-3 max-w-[300px] text-gray-500 truncate">{f.content || '-'}</td>
                <td className="p-3">{STATUS[f.status]}</td>
                <td className="p-3 text-xs text-gray-500">{new Date(f.createdAt).toLocaleString('zh-CN')}</td>
                <td className="p-3 text-right">
                  <FeedbackActions id={String(f.id)} status={f.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
