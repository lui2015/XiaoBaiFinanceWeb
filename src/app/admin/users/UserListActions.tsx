'use client';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http';

export default function UserListActions({ id, status }: { id: string; status: number }) {
  const router = useRouter();
  async function setStatus(s: 0 | 1) {
    if (!confirm(s === 1 ? '确认封禁？' : '确认解封？')) return;
    const r = await apiFetch(`/api/admin/users/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    });
    if (r.ok) router.refresh();
  }
  if (status === 0) return <button onClick={() => setStatus(1)} className="text-rose-500 text-xs">封禁</button>;
  if (status === 1) return <button onClick={() => setStatus(0)} className="text-emerald-600 text-xs">解封</button>;
  return <span className="text-xs text-gray-400">-</span>;
}
