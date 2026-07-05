/**
 * 对外开放接口的 API Key 认证。
 *
 * 设计原则（遵循 secrets env-only 规范）：
 * - Key 只从环境变量读取，不落库、不写日志、不进代码。
 * - 支持多把 Key：环境变量 OPEN_API_KEYS，用逗号分隔。
 * - 比对使用 SHA-256 摘要 + timingSafeEqual，避免时序攻击与长度泄露。
 *
 * 请求侧支持两种携带方式（任选其一）：
 *   Authorization: Bearer <key>
 *   X-API-Key: <key>
 */
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiErrors } from './api';

/** 读取并缓存已配置的 Key 摘要集合。 */
let cachedDigests: Buffer[] | null = null;

function loadKeyDigests(): Buffer[] {
  if (cachedDigests) return cachedDigests;
  const raw = process.env.OPEN_API_KEYS || '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length >= 16); // 过短的 key 直接忽略，避免弱口令
  cachedDigests = keys.map((k) => crypto.createHash('sha256').update(k).digest());
  return cachedDigests;
}

function sha256(input: string): Buffer {
  return crypto.createHash('sha256').update(input).digest();
}

/** 时序安全比对：候选 key 是否命中任一已配置 key。 */
function matchKey(candidate: string): boolean {
  const digests = loadKeyDigests();
  if (digests.length === 0) return false;
  const candDigest = sha256(candidate);
  let hit = false;
  // 遍历全部，避免因提前返回造成时序差异
  for (const d of digests) {
    if (d.length === candDigest.length && crypto.timingSafeEqual(d, candDigest)) {
      hit = true;
    }
  }
  return hit;
}

/** 从请求中提取 API Key（Bearer 优先，其次 X-API-Key）。 */
function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  const x = req.headers.get('x-api-key');
  if (x) return x.trim();
  return null;
}

/**
 * 校验对外接口调用凭证。失败抛出统一 ApiError。
 * 返回命中的 key 摘要前缀（脱敏，用于日志关联，不含明文）。
 */
export function requireApiKey(req: NextRequest): { keyRef: string } {
  if (loadKeyDigests().length === 0) {
    // 未配置任何 key —— 直接拒绝，避免误开放
    throw ApiErrors.forbidden('对外接口未启用');
  }
  const key = extractKey(req);
  if (!key) throw ApiErrors.unauthorized('缺少 API Key');
  if (!matchKey(key)) throw ApiErrors.unauthorized('API Key 无效');
  // keyRef：明文的 sha256 前 8 位十六进制，仅用于审计关联，不可反推明文
  const keyRef = sha256(key).toString('hex').slice(0, 8);
  return { keyRef };
}
