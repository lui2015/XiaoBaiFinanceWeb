'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Item { id: string; username: string; role: number; status: number; realName: string | null; lastLoginAt: string | null; lastLoginIp: string | null }

export default function AdminClient({ list }: { list: Item[] }) {
  const router = useRouter();
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [role, setRole] = useState<1 | 2>(1);
  async function create() {
    const r = await fetch('/api/admin/admins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, role }),
    });
    if (r.ok) { setU(''); setP(''); router.refresh(); }
    else alert((await r.json()).message);
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-3">
      <div className="bg-white rounded border border-gray-100">
        <h2 className="font-semibold p-3 border-b border-gray-100">管理员账号</h2>
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="text-left p-3">用户名</th>
              <th className="text-left p-3">角色</th>
              <th className="text-left p-3">最后登录</th>
              <th className="text-left p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="p-3">{a.username}{a.realName ? ` (${a.realName})` : ''}</td>
                <td className="p-3">{a.role === 2 ? '超级管理员' : '管理员'}</td>
                <td className="p-3 text-xs text-gray-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('zh-CN') : '-'}</td>
                <td className="p-3 text-xs text-gray-500">{a.lastLoginIp || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold mb-2">新增管理员</h2>
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="用户名" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
        <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="初始密码（≥ 8 位含字母数字）" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
        <select value={role} onChange={(e) => setRole(Number(e.target.value) as 1 | 2)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
          <option value="1">管理员</option>
          <option value="2">超级管理员</option>
        </select>
        <button onClick={create} className="w-full bg-brand-500 text-white py-1.5 rounded text-sm">新增</button>
      </div>
    </div>
  );
}
