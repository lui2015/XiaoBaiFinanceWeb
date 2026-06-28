'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * 登录引导弹窗：在用户尝试触发互动时弹出
 * 通过监听全局事件 'xb:require-login' 打开
 */
import { useEffect } from 'react';

export default function LoginPromptModal() {
  const [open, setOpen] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ returnTo?: string }>;
      setReturnTo(ce.detail?.returnTo ?? location.pathname + location.search);
      setOpen(true);
    };
    window.addEventListener('xb:require-login', handler);
    return () => window.removeEventListener('xb:require-login', handler);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl p-6 w-full sm:w-[360px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">登录后即可继续</h3>
          <button onClick={() => setOpen(false)} aria-label="关闭"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">收藏、点赞、反馈等功能需要登录后使用。</p>
        <button
          className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded mb-2"
          onClick={() => router.push(`/login?returnTo=${encodeURIComponent(returnTo || '/')}`)}>
          手机号一键登录
        </button>
        <button
          className="w-full border border-gray-200 py-2.5 rounded text-sm"
          onClick={() => setOpen(false)}>
          稍后再说
        </button>
      </div>
    </div>
  );
}

export function requireLogin(returnTo?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('xb:require-login', { detail: { returnTo } }));
}
