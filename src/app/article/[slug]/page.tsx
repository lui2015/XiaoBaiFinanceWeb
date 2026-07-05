import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildToc } from '@/lib/sanitize';
import ArticleClient from './ArticleClient';
import ArticleHtml from '@/components/ArticleHtml';
import LoginPromptModal from '@/components/LoginPromptModal';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const slug = decodeSlug(params.slug);
  const a = await prisma.article.findFirst({
    where: { slug, deletedAt: null, status: 1 },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!a) notFound();
  const { html } = buildToc(a.contentHtml);
  const isHtmlSource = a.sourceType === 0;
  const [related, prevArt, nextArt, user] = await Promise.all([
    prisma.article.findMany({
      where: { categoryId: a.categoryId, status: 1, deletedAt: null, NOT: { id: a.id } },
      orderBy: { publishAt: 'desc' }, take: 4,
      select: { id: true, title: true, slug: true },
    }),
    prisma.article.findFirst({
      where: { categoryId: a.categoryId, status: 1, deletedAt: null, id: { lt: a.id } },
      orderBy: { id: 'desc' }, select: { id: true, title: true, slug: true },
    }),
    prisma.article.findFirst({
      where: { categoryId: a.categoryId, status: 1, deletedAt: null, id: { gt: a.id } },
      orderBy: { id: 'asc' }, select: { id: true, title: true, slug: true },
    }),
    getCurrentUser(),
  ]);

  let liked = false, favorited = false;
  if (user) {
    const [l, f] = await Promise.all([
      prisma.userLike.findUnique({ where: { userId_articleId: { userId: user.id, articleId: a.id } } }),
      prisma.userFavorite.findUnique({ where: { userId_articleId: { userId: user.id, articleId: a.id } } }),
    ]);
    liked = !!l; favorited = !!f;
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <article>
        <nav className="text-xs sm:text-sm text-gray-500 mb-3">
          <Link href="/" className="hover:text-brand-500">首页</Link>
          <span className="mx-1">/</span>
          <Link href={`/category/${a.category.slug}`} className="hover:text-brand-500">{a.category.name}</Link>
          {a.subCategory && (
            <>
              <span className="mx-1">/</span>
              <Link href={`/category/${a.category.slug}?sub=${a.subCategory.slug}`} className="hover:text-brand-500">{a.subCategory.name}</Link>
            </>
          )}
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-snug">{a.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
          <span>{a.publishAt ? new Date(a.publishAt).toLocaleString('zh-CN') : ''}</span>
          <span>· 阅读 {a.viewCount}</span>
          <span>· 收藏 {a.favoriteCount}</span>
          <span>· 点赞 {a.likeCount}</span>
        </div>

        <ArticleClient
          articleId={String(a.id)}
          initialLiked={liked}
          initialFavorited={favorited}
          isLogin={!!user}
          isManager={!!user && user.isAdmin}
        >
          {isHtmlSource ? (
            <div className="bg-white rounded-lg overflow-hidden border border-gray-100">
              <ArticleHtml html={html} />
            </div>
          ) : (
            <div className="article-prose bg-white rounded-lg p-5 sm:p-8 border border-gray-100" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </ArticleClient>

        {/* 上下篇 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {prevArt ? (
            <Link href={`/article/${prevArt.slug}`} className="bg-white p-3 rounded border border-gray-100 hover:border-brand-500">
              <div className="text-xs text-gray-400 mb-1">上一篇</div>
              <div className="text-sm line-clamp-1">{prevArt.title}</div>
            </Link>
          ) : <div />}
          {nextArt ? (
            <Link href={`/article/${nextArt.slug}`} className="bg-white p-3 rounded border border-gray-100 hover:border-brand-500 text-right">
              <div className="text-xs text-gray-400 mb-1">下一篇</div>
              <div className="text-sm line-clamp-1">{nextArt.title}</div>
            </Link>
          ) : <div />}
        </div>

        {/* 相关推荐 */}
        {related.length > 0 && (
          <section className="mt-8">
            <h3 className="font-semibold mb-3">相关推荐</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link key={String(r.id)} href={`/article/${r.slug}`} className="bg-white p-3 rounded border border-gray-100 hover:border-brand-500 text-sm">
                  {r.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <LoginPromptModal />
    </div>
  );
}
