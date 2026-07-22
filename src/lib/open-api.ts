import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiErrors } from '@/lib/api';

/**
 * 开放平台 API Key 工具
 * - 明文 token 仅在创建时返回一次，库中只保存 sha256 哈希
 * - 通过 Authorization: Bearer <token> 或 x-api-key: <token> 鉴权
 */

export interface GeneratedKey {
  token: string; // 明文，仅创建时返回
  keyHash: string; // sha256
  keyPrefix: string; // 用于界面展示，如 xbk_live_a1b2c3...
}

export function generateApiKey(): GeneratedKey {
  const token = 'xbk_live_' + crypto.randomBytes(24).toString('base64url');
  const keyHash = crypto.createHash('sha256').update(token).digest('hex');
  const keyPrefix = token.slice(0, 18);
  return { token, keyHash, keyPrefix };
}

export function hashApiKey(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** 从请求头中提取 API Key（支持 Bearer 与 x-api-key） */
export function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const xk = req.headers.get('x-api-key');
  return xk ? xk.trim() : null;
}

export interface ResolvedKey {
  id: bigint;
  userId: bigint;
  name: string | null;
}

/** 解析并校验 API Key，无效/停用则抛出 401 */
export async function resolveOpenApiKey(req: NextRequest): Promise<ResolvedKey> {
  const token = extractApiKey(req);
  if (!token) {
    throw ApiErrors.unauthorized('缺少 API Key，请在请求头携带 Authorization: Bearer <key> 或 x-api-key');
  }
  const keyHash = hashApiKey(token);
  const key = await prisma.openApiKey.findUnique({ where: { keyHash } });
  if (!key || key.status !== 1) {
    throw ApiErrors.unauthorized('API Key 无效或已停用');
  }
  return { id: key.id, userId: key.userId, name: key.name };
}

/** 记录一次成功的开放接口调用（更新密钥最后使用时间 + 累计当日/总调用次数） */
export async function recordOpenApiCall(userId: bigint, keyId: bigint): Promise<void> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  await prisma.openApiKey.update({
    where: { id: keyId },
    data: { lastUsedAt: new Date() },
  });
  await prisma.openApiCallStat.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, callCount: 1 },
    update: { callCount: { increment: 1 } },
  });
}

/** 查询某用户当日与累计调用次数 */
export async function getOpenApiStats(userId: bigint): Promise<{ today: number; total: number }> {
  const date = new Date().toISOString().slice(0, 10);
  const [todayRow, agg] = await Promise.all([
    prisma.openApiCallStat.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.openApiCallStat.aggregate({ _sum: { callCount: true }, where: { userId } }),
  ]);
  return {
    today: todayRow ? Number(todayRow.callCount) : 0,
    total: agg._sum.callCount ? Number(agg._sum.callCount) : 0,
  };
}
