import Link from 'next/link';
import { Eye, Heart } from 'lucide-react';
import { apiUrl } from '@/lib/http';

export interface ArticleCardItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverUrl: string | null;
  viewCount: number;
  likeCount: number;
  publishAt: string | Date | null;
  category?: { id: string; name: string; slug: string };
}

// 分类彩色标签：按名称稳定映射到活力配色
const CHIP_COLORS = ['bg-sunny', 'bg-mint', 'bg-sky', 'bg-coral', 'bg-grape'];
function chipColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

export default function ArticleCard({ a }: { a: ArticleCardItem }) {
  const date = a.publishAt ? new Date(a.publishAt).toLocaleDateString('zh-CN') : '';
  const catColor = a.category ? chipColor(a.category.name) : 'bg-sunny';

  return (
    <Link
      href={`/article/${a.slug}`}
      className="comic-card comic-card-hover group block overflow-hidden"
    >
      {a.coverUrl && (
        <div className="relative border-b-2 border-ink overflow-hidden">
          <img
            src={apiUrl(a.coverUrl)}
            alt=""
            className="w-full h-44 sm:h-52 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {a.category && (
            <span className={`absolute top-3 left-3 comic-badge ${catColor} text-ink`}>
              {a.category.name}
            </span>
          )}
        </div>
      )}
      <div className="p-4">
        {!a.coverUrl && a.category && (
          <span className={`comic-badge ${catColor} text-ink mb-2`}>{a.category.name}</span>
        )}
        <h3 className="font-black text-lg leading-snug text-ink group-hover:text-brand-600 line-clamp-2">
          {a.title}
        </h3>
        {a.summary && (
          <p className="text-sm text-ink/55 mt-2 line-clamp-2 leading-relaxed">{a.summary}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-ink/45 mt-3 font-semibold">
          <span className="inline-flex items-center gap-1"><Eye size={14} />{a.viewCount}</span>
          <span className="inline-flex items-center gap-1"><Heart size={14} />{a.likeCount}</span>
          {date && <span className="ml-auto">{date}</span>}
        </div>
      </div>
    </Link>
  );
}
