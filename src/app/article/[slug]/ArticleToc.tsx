'use client';
import type { TocItem } from '@/lib/sanitize';

/** 目录（用于 iframe 渲染的 HTML 文章）：点击后通过 postMessage 跳转到 iframe 内标题 */
export default function ArticleToc({ items }: { items: TocItem[] }) {
  if (!items.length) return <div className="text-xs text-gray-400">无小节</div>;
  return (
    <ul className="text-sm space-y-1">
      {items.map((t) => (
        <li key={t.id} style={{ paddingLeft: t.level === 3 ? 12 : 0 }}>
          <button
            type="button"
            onClick={() => (window as unknown as { __xbfScrollArticle?: (id: string) => void }).__xbfScrollArticle?.(t.id)}
            className="block w-full text-left text-gray-600 hover:text-brand-500 line-clamp-1"
          >
            {t.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
