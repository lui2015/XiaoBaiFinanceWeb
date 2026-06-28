import Link from 'next/link';

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

export default function ArticleCard({ a }: { a: ArticleCardItem }) {
  const date = a.publishAt ? new Date(a.publishAt).toLocaleDateString('zh-CN') : '';
  return (
    <Link
      href={`/article/${a.slug}`}
      className="group block bg-white rounded-lg p-4 hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="flex gap-4">
        {a.coverUrl && (
          <img
            src={a.coverUrl}
            alt=""
            className="w-24 h-24 sm:w-32 sm:h-24 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg group-hover:text-brand-500 line-clamp-2">{a.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.summary}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
            {a.category && <span className="text-brand-500">{a.category.name}</span>}
            <span>{date}</span>
            <span>{a.viewCount} 阅读</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
