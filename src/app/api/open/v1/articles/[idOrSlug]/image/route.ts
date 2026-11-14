import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, fail } from '@/lib/api';
import { requireOpenApiKey, recordOpenCall } from '@/lib/open-auth';
import { buildShareImageSvg, findPublicArticle, SHARE_IMAGE_MIME } from '@/lib/share-image';

export const runtime = 'nodejs';

/**
 * 开放接口：获取文章分享图（SVG 图片二进制）。
 * 需要 API Key；与站内 `/api/articles/{idOrSlug}/image` 生成的是同一张图。
 */
export async function GET(req: NextRequest, { params }: { params: { idOrSlug: string } }) {
  try {
    const ctx = await requireOpenApiKey(req);
    const a = await findPublicArticle(params.idOrSlug);
    if (!a) throw ApiErrors.notFound('文章不存在或未发布');
    await recordOpenCall(ctx);
    return new NextResponse(buildShareImageSvg(a), {
      status: 200,
      headers: {
        'Content-Type': SHARE_IMAGE_MIME,
        // 接口需鉴权，避免共享缓存把内容缓存给未授权方
        'Cache-Control': 'private, max-age=3600',
        'Vary': 'Authorization',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="article-${a.id}.svg"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
