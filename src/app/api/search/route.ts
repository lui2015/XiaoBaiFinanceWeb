import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { parsePage, getClientIp, getUA } from '@/lib/utils';
import { getSearch } from '@/lib/search';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  keyword: z.string().min(1).max(40),
  categoryId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const sp = req.nextUrl.searchParams;
    const q = schema.parse({ keyword: sp.get('keyword') || '', categoryId: sp.get('categoryId') || undefined });
    const { page, size } = parsePage(sp);
    const result = await getSearch().search({
      keyword: q.keyword,
      categoryId: q.categoryId ? BigInt(q.categoryId) : undefined,
      page, size,
    });
    // 异步写搜索日志（不影响响应）
    prisma.searchLog.create({
      data: {
        keyword: q.keyword,
        resultCount: result.total,
        ip: getClientIp(req),
        ua: getUA(req),
      },
    }).catch(() => {});
    return jsonSafe({ list: result.list, total: result.total, page, size });
  });
}
