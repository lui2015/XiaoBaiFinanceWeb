'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Menu, X, Search } from 'lucide-react';
import { toast } from '@/components/Toaster';
import { apiFetch } from '@/lib/http';

interface Cat { id: string; name: string; slug: string }
interface UserLite { id: string; nickname: string; avatarUrl: string | null; isAdmin: boolean }

export default function HeaderNav({ categories, user }: { categories: Cat[]; user: UserLite | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [kw, setKw] = useState(sp.get('keyword') || '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = kw.trim();
    if (!q) return;
    router.push(`/search?keyword=${encodeURIComponent(q)}`);
    setMobileOpen(false);
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    toast('已退出登录', 'success');
    setMenuOpen(false);
    setMobileOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <>
      {/* 桌面端导航 */}
      <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
        <Link href="/" className="text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 hover:bg-sunny hover:text-ink transition-colors">首页</Link>
        {categories.map(c => (
          <Link key={c.id} href={`/category/${c.slug}`} className="text-sm font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 text-ink/80 hover:bg-mint/20 hover:text-ink transition-colors">
            {c.name}
          </Link>
        ))}
      </nav>
      <form onSubmit={submitSearch} className="hidden md:flex items-center bg-white border-2 border-ink rounded-full px-3 py-1.5 w-60 shrink-0 shadow-comic-sm focus-within:shadow-comic transition-shadow">
        <Search size={16} className="text-ink/50" />
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜点啥？"
          className="bg-transparent flex-1 outline-none text-sm px-2 font-medium"
        />
      </form>
      <div className="hidden md:flex items-center gap-3">
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 text-sm font-bold"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-ink" />
                : <div className="w-8 h-8 rounded-full bg-coral text-white text-xs flex items-center justify-center border-2 border-ink shadow-comic-sm">{user.nickname.slice(0,1)}</div>}
              <span className="max-w-[80px] truncate">{user.nickname}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white border-2 border-ink rounded-xl shadow-comic overflow-hidden z-50">
                <Link href="/me" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-mint/20">个人信息</Link>
                {user.isAdmin && (
                  <Link href="/me/manage" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sunny">设置</Link>
                )}
                <button onClick={logout} className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-ink border-t border-ink/10 hover:bg-coral/10 hover:text-coral">退出登录</button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="comic-btn bg-sunny text-ink text-sm">登录 / 注册</Link>
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
          <div className="absolute right-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-cream border-l-2 border-ink shadow-xl p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-black text-lg">导航</span>
              <button onClick={() => setMobileOpen(false)} aria-label="关闭"><X size={20} /></button>
            </div>
            <form onSubmit={submitSearch} className="flex items-center bg-white border-2 border-ink rounded-full px-3 py-2 mb-4 shadow-comic-sm">
              <Search size={16} className="text-ink/50" />
              <input
                autoFocus
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="搜点啥？"
                className="bg-transparent flex-1 outline-none text-sm px-2 font-medium"
              />
            </form>
            <div className="flex flex-col gap-1">
              <Link href="/" onClick={() => setMobileOpen(false)} className="py-2 px-3 rounded-xl font-bold hover:bg-sunny">首页</Link>
              {categories.map(c => (
                <Link key={c.id} href={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="py-2 px-3 rounded-xl font-semibold text-ink/80 hover:bg-mint/20">{c.name}</Link>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link href="/me" onClick={() => setMobileOpen(false)} className="comic-btn bg-mint text-ink w-full">个人中心</Link>
                    {user.isAdmin && (
                      <Link href="/me/manage" onClick={() => setMobileOpen(false)} className="comic-btn bg-sunny text-ink w-full">设置</Link>
                    )}
                    <button onClick={logout} className="comic-btn bg-white text-ink w-full">退出登录</button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="comic-btn bg-sunny text-ink w-full">登录 / 注册</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
