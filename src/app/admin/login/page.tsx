'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get('returnTo') || '/admin';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    const data = await r.json();
    if (!r.ok) return setErr(data.message || '登录失败');
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-[360px] shadow-xl">
        <h1 className="text-xl font-bold mb-1">小白财经 · 后台</h1>
        <p className="text-xs text-gray-500 mb-5">管理员登录</p>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名"
          className="w-full border border-gray-200 rounded px-3 py-2.5 mb-3 outline-none focus:border-brand-500" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码"
          className="w-full border border-gray-200 rounded px-3 py-2.5 mb-3 outline-none focus:border-brand-500" />
        {err && <div className="text-rose-500 text-sm mb-3">{err}</div>}
        <button disabled={loading} className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded disabled:opacity-50">
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
