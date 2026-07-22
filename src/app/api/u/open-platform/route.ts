/**
 * 开放平台（用户侧）
 * GET  /api/u/open-platform  -> 密钥列表 + 当日/累计调用次数
 * POST /api/u/open-platform  -> 创建新密钥（明文 token 仅在响应中返回一次）
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { generateApiKey, getOpenApiStats } from '@/lib/open-api';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1).max(40).optional(),
});

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) throw ApiErrors.unauthorized('请先登录');

    const [keys, stats] = await Promise.all([
      prisma.openApiKey.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          keyPrefix: true,
          name: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
      getOpenApiStats(user.id),
    ]);

    return jsonSafe({
      keys: keys.map((k) => ({
        id: String(k.id),
        keyPrefix: k.keyPrefix,
        name: k.name,
        status: k.status,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      })),
      today: stats.today,
      total: stats.total,
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) throw ApiErrors.unauthorized('请先登录');

    const body = createSchema.parse(await req.json().catch(() => ({})));
    const { token, keyHash, keyPrefix } = generateApiKey();

    const key = await prisma.openApiKey.create({
      data: {
        userId: user.id,
        keyHash,
        keyPrefix,
        name: body.name ? body.name.trim() : null,
        status: 1,
      },
      select: { id: true, keyPrefix: true, name: true, createdAt: true },
    });

    // 明文 token 仅在此处返回一次，关闭后将无法再次查看
    return jsonSafe({
      id: String(key.id),
      keyPrefix: key.keyPrefix,
      name: key.name,
      token,
      createdAt: key.createdAt.toISOString(),
    });
  });
}
