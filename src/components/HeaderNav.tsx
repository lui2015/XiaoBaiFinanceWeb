'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Search } from 'lucide-react';

interface Cat { id: string; name: string; slug: string }
interface UserLite { id: string; nickname: string; avatarUrl: string | null }

export default function HeaderNav({ categories, user }: { categories: Cat[]; user: UserLite | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [kw, setKw] = useState(sp.get('keyword') || '');

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = kw.trim();
    if (!q) return;
    router.push(`/search?keyword=${encodeURIComponent(q)}`);
    setMobileOpen(false);
  }

  return (
    <>
      {/* 桌面端导航 */}
      <nav className="hidden md:flex items-center gap-5 flex-1">
        <Link href="/" className="text-sm hover:text-brand-500">首页</Link>
        {categories.map(c => (
          <Link key={c.id} href={`/category/${c.slug}`} className="text-sm hover:text-brand-500">
            {c.name}
          </Link>
        ))}
      </nav>
      <form onSubmit={submitSearch} className="hidden md:flex items-center bg-gray-100 rounded-full px-3 py-1.5 w-64">
        <Search size={16} className="text-gray-400" />
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索财经知识..."
          className="bg-transparent flex-1 outline-none text-sm px-2"
        />
      </form>
      <div className="hidden md:flex items-center gap-3">
        {user ? (
          <Link href="/me" className="flex items-center gap-2 text-sm">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
              : <div className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">{user.nickname.slice(0,1)}</div>}
            <span className="max-w-[80px] truncate">{user.nickname}</span>
          </Link>
        ) : (
          <Link href="/login" className="text-sm text-brand-500 hover:underline">登录 / 注册</Link>
        )}
      </div>

      {/* 移动端按钮 */}
      <div className="md:hidden ml-auto flex items-center gap-3">
        <button aria-label="搜索" onClick={() => setMobileOpen(true)}><Search size={20} /></button>
        <button aria-label="菜单" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
      </div>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-white shadow-xl p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">导航</span>
              <button onClick={() => setMobileOpen(false)} aria-label="关闭"><X size={20} /></button>
            </div>
            <form onSubmit={submitSearch} className="flex items-center bg-gray-100 rounded-full px-3 py-2 mb-4">
              <Search size={16} className="text-gray-400" />
              <input
                autoFocus
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="搜索财经知识..."
                className="bg-transparent flex-1 outline-none text-sm px-2"
              />
            </form>
            <div className="flex flex-col">
              <Link href="/" onClick={() => setMobileOpen(false)} className="py-2 border-b border-gray-100">首页</Link>
              {categories.map(c => (
                <Link key={c.id} href={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="py-2 border-b border-gray-100">{c.name}</Link>
              ))}
              <div className="mt-3">
                {user ? (
                  <Link href="/me" onClick={() => setMobileOpen(false)} className="text-brand-500">个人中心</Link>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="text-brand-500">登录 / 注册</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
