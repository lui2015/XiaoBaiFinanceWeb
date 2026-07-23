import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors } from '@/lib/api';
import { fixedWindow } from '@/lib/rate-limit';
import { getClientIp, getUA } from '@/lib/utils';
import { sha256Hex } from '@/lib/crypto';

export async function POST(req: NextRequest, { params }: { params: { idOrSlug: string } }) {
  return apiHandler(async () => {
    if (!/^\d+$/.test(params.idOrSlug)) throw ApiErrors.badRequest();
    const articleId = Number(params.idOrSlug);
    const ip = getClientIp(req);
    const ua = getUA(req);
    // 防刷：30 分钟内同一 IP 同一文章只计 1 次
    const dedupKey = `view:${articleId}:${sha256Hex(ip + '|' + ua)}`;
    if (!fixedWindow(dedupKey, 1, 60 * 30)) {
      return { counted: false };
    }
    await prisma.$transaction([
      prisma.article.update({
        where: { id: articleId },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.articleViewLog.create({ data: { articleId, ip, ua } }),
    ]);
    return { counted: true };
  });
}
