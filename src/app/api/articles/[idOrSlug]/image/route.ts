import { NextRequest, NextResponse } from 'next/server';
import { buildShareImageSvg, findPublicArticle, SHARE_IMAGE_MIME } from '@/lib/share-image';

export const runtime = 'nodejs';

/**
 * 站内公开：文章分享图（SVG）。
 * 供文章详情页「导出为图片」按钮调用；只返回已发布、未删除的文章，无需登录。
 */
export async function GET(_req: NextRequest, { params }: { params: { idOrSlug: string } }) {
  const a = await findPublicArticle(params.idOrSlug);
  if (!a) {
    return NextResponse.json({ code: 1004, message: '文章不存在或未发布' }, { status: 404 });
  }
  return new NextResponse(buildShareImageSvg(a), {
    status: 200,
    headers: {
      'Content-Type': SHARE_IMAGE_MIME,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="article-${a.id}.svg"`,
    },
  });
}
