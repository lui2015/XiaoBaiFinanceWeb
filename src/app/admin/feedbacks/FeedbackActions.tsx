'use client';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http';

export default function FeedbackActions({ id, status }: { id: string; status: number }) {
  const router = useRouter();
  async function setStatus(s: 0 | 1 | 2 | 3) {
    const r = await apiFetch(`/api/admin/feedbacks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    });
    if (r.ok) router.refresh();
  }
  return (
    <div className="flex gap-2 justify-end text-xs">
      {status !== 1 && <button className="text-emerald-600" onClick={() => setStatus(1)}>采纳</button>}
      {status !== 2 && <button className="text-brand-500" onClick={() => setStatus(2)}>已修复</button>}
      {status !== 3 && <button className="text-gray-500" onClick={() => setStatus(3)}>关闭</button>}
    </div>
  );
}
