'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http';

interface Sub { id: string; name: string; slug: string; status: number; sortOrder: number }
interface Top extends Sub { children: Sub[] }

export default function CategoryClient({ initial }: { initial: Top[] }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(initial[0]?.id || null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');

  async function create() {
    if (!name || !slug) return alert('name/slug 必填');
    const r = await apiFetch('/api/admin/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, parentId: parentId || null }),
    });
    if (r.ok) { setName(''); setSlug(''); router.refresh(); }
    else alert((await r.json()).message);
  }
  async function patch(id: string, data: any) {
    const r = await apiFetch(`/api/admin/categories/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (r.ok) router.refresh();
    else alert((await r.json()).message);
  }
  async function del(id: string) {
    if (!confirm('确认删除？')) return;
    const r = await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (r.ok) router.refresh();
    else alert((await r.json()).message);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white rounded border border-gray-100">
        <h2 className="font-semibold p-3 border-b border-gray-100">分类列表</h2>
        <ul>
          {initial.map(t => (
            <li key={t.id}>
              <div className={`p-3 flex justify-between items-center ${active === t.id ? 'bg-blue-50' : ''}`}>
                <button onClick={() => setActive(t.id)} className="font-medium">{t.name}</button>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => patch(t.id, { status: t.status === 1 ? 0 : 1 })}
                    className={t.status === 1 ? 'text-amber-500' : 'text-emerald-500'}>
                    {t.status === 1 ? '停用' : '启用'}
                  </button>
                  <button onClick={() => del(t.id)} className="text-rose-500">删除</button>
                </div>
              </div>
              {active === t.id && t.children.length > 0 && (
                <ul className="bg-gray-50">
                  {t.children.map(s => (
                    <li key={s.id} className="p-3 pl-8 flex justify-between items-center text-sm">
                      <span>· {s.name} <span className="text-gray-400">/{s.slug}</span></span>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => patch(s.id, { status: s.status === 1 ? 0 : 1 })}
                          className={s.status === 1 ? 'text-amber-500' : 'text-emerald-500'}>
                          {s.status === 1 ? '停用' : '启用'}
                        </button>
                        <button onClick={() => del(s.id)} className="text-rose-500">删除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded border border-gray-100 p-4">
        <h2 className="font-semibold mb-3">新增分类</h2>
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="名称"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug（英文小写连字符）"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
            <option value="">作为一级分类</option>
            {initial.map(t => <option key={t.id} value={t.id}>归到「{t.name}」下</option>)}
          </select>
          <button onClick={create} className="w-full bg-brand-500 text-white py-1.5 rounded text-sm">新增</button>
        </div>
      </div>
    </div>
  );
}
