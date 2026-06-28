'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ArticleListActions({ id, status, slug }: { id: string; status: number; slug: string }) {
  const router = useRouter();
  async function setStatus(s: number) {
    const r = await fetch(`/api/admin/articles/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    });
    if (r.ok) router.refresh();
  }
  async function del() {
    if (!confirm('确认删除？')) return;
    const r = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
    if (r.ok) router.refresh();
  }
  return (
    <div className="flex justify-end gap-2 text-xs">
      <Link href={`/admin/articles/${id}/edit`} className="text-brand-500 hover:underline">编辑</Link>
      {status === 0 && <button onClick={() => setStatus(1)} className="text-emerald-600 hover:underline">发布</button>}
      {status === 1 && <button onClick={() => setStatus(2)} className="text-amber-600 hover:underline">下架</button>}
      {status === 2 && <button onClick={() => setStatus(1)} className="text-emerald-600 hover:underline">上架</button>}
      <Link href={`/article/${slug}`} target="_blank" className="text-gray-500 hover:underline">预览</Link>
      <button onClick={del} className="text-rose-500 hover:underline">删除</button>
    </div>
  );
}
