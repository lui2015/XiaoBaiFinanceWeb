'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * 亮色 / 赛博朋克暗色 切换按钮。
 * - 通过在 <html> 上切换 `dark` 类驱动全站配色（Tailwind darkMode: 'class'）。
 * - 选择持久化到 localStorage('xb-theme')，并在 layout 的内联脚本中提前应用以避免闪烁。
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('xb-theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '切换到亮色模式' : '切换到暗色模式'}
      title={dark ? '亮色模式' : '赛博朋克暗色'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-ink bg-white text-ink shadow-comic-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-comic active:translate-y-0 active:shadow-none ${className}`}
    >
      {/* 未挂载时用占位图标，避免 hydration 不一致 */}
      {mounted && dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
