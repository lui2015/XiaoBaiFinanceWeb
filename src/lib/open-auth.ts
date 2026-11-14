/**
 * 开放接口统一鉴权。
 *
 * 兼容三类凭证，任一命中即可调用开放接口：
 *  1) 数据库密钥 xbk_live_*（OpenApiKey，仅存 sha256 哈希，按用户统计）
 *  2) 文件式密钥 xb_open_*（管理端「内容管理 → 开放平台」生成）
 *  3) 环境变量密钥 OPEN_API_KEY / OPEN_API_KEYS
 *
 * 安全约束：
 *  - 一律用 SHA-256 摘要 + timingSafeEqual 比对，避免时序泄露与明文比较。
 *  - 限流以「凭证摘要」为维度，不信任可伪造的 X-Forwarded-For。
 *  - keyRef 为脱敏摘要，仅用于日志/限流关联，不可反推明文。
 *  - 只返回已发布、未删除的公开数据；凭证明文不写日志、不进 URL（仅投稿接口为兼容保留 ?key=）。
 */
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiErrors } from '@/lib/api';
import { fixedWindow } from '@/lib/rate-limit';
import { envOpenKeys, readOpenKeys } from '@/lib/open-keys';
import { recordOpenApiCall } from '@/lib/open-api';
import { bumpStats } from '@/lib/openStats';

export interface OpenKeyContext {
  keyRef: string;
  kind: 'db' | 'file' | 'env';
  userId?: number;
  keyId?: number;
}

/** 默认每密钥每分钟 120 次；投稿等写接口可单独收紧。 */
export const OPEN_RATE_LIMIT = 120;

function sha256(input: string): Buffer {
  return crypto.createHash('sha256').update(input).digest();
}

function matchDigest(candidate: Buffer, digests: Buffer[]): boolean {
  let hit = false;
  // 遍历全部，不提前返回，避免时序差异
  for (const d of digests) {
    if (d.length === candidate.length && crypto.timingSafeEqual(d, candidate)) hit = true;
  }
  return hit;
}

export function extractOpenKey(req: NextRequest, allowQuery = false): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  const x = req.headers.get('x-api-key');
  if (x) return x.trim();
  // 仅为兼容旧投稿调用方保留；新接口请勿开启（密钥会进入访问日志）
  if (allowQuery) return new URL(req.url).searchParams.get('key')?.trim() || null;
  return null;
}

/**
 * 校验调用凭证，失败抛出统一 ApiError（由 apiHandler/fail 转成标准响应）。
 * 校验通过后再限流，避免无效凭证无限膨胀限流计数器。
 */
export async function requireOpenApiKey(
  req: NextRequest,
  opts: { allowQuery?: boolean; limit?: number; scope?: 'data' | 'submit' } = {},
): Promise<OpenKeyContext> {
  const token = extractOpenKey(req, opts.allowQuery);
  if (!token) {
    throw ApiErrors.unauthorized('缺少 API Key，请在请求头携带 Authorization: Bearer <key> 或 X-API-Key: <key>');
  }

  const digest = sha256(token);
  const digestHex = digest.toString('hex');
  const keyRef = digestHex.slice(0, 8);

  // 1) 数据库密钥（哈希精确匹配，天然无时序问题）
  //    仅对 xbk_live_ 前缀查库：文件式/环境变量密钥无需访问数据库，
  //    也避免未执行 migration 时产生大量「表不存在」日志
  const dbKey = token.startsWith('xbk_live_')
    ? await prisma.openApiKey
        .findUnique({ where: { keyHash: digestHex }, select: { id: true, userId: true, status: true } })
        .catch(() => null) // 表不存在/数据库异常时降级到文件与环境变量校验
    : null;
  let ctx: OpenKeyContext | null = null;
  if (dbKey) {
    if (dbKey.status !== 1) throw ApiErrors.unauthorized('API Key 已停用');
    ctx = { keyRef, kind: 'db', userId: dbKey.userId, keyId: dbKey.id };
  }

  // 2) 环境变量密钥 / 文件式密钥
  if (!ctx) {
    const [envKeys, fileKeys] = await Promise.all([Promise.resolve(envOpenKeys()), readOpenKeys()]);
    if (matchDigest(digest, envKeys.map(sha256))) {
      ctx = { keyRef, kind: 'env' };
    } else if (matchDigest(digest, fileKeys.map(sha256))) {
      ctx = { keyRef, kind: 'file' };
    }
  }

  if (!ctx) throw ApiErrors.unauthorized('API Key 无效');

  // 读接口与投稿接口分桶计数，互不挤占配额
  const scope = opts.scope ?? 'data';
  const limit = opts.limit ?? (scope === 'submit' ? 60 : OPEN_RATE_LIMIT);
  if (!fixedWindow(`open:${scope}:${ctx.keyRef}`, limit, 60)) {
    throw ApiErrors.tooMany(`调用过于频繁，请稍后重试（每密钥每分钟 ${limit} 次）`);
  }
  return ctx;
}

/** 记录一次成功调用：数据库密钥计入用户维度统计，其余计入开放平台全局统计。统计失败不阻断业务。 */
export async function recordOpenCall(ctx: OpenKeyContext): Promise<void> {
  try {
    if (ctx.kind === 'db' && ctx.userId && ctx.keyId) {
      await recordOpenApiCall(ctx.userId, ctx.keyId);
    } else {
      await bumpStats();
    }
  } catch {
    /* 统计失败不影响接口返回 */
  }
}
