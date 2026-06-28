/**
 * 进程内令牌桶限流（开发/单实例可用）。生产建议接 Redis。
 * 用法：await rateLimit(`sms:${phoneHash}`, { capacity: 1, refillPerSec: 1/60 })
 */
type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  capacity: number;       // 桶容量（最大瞬时 burst）
  refillPerSec: number;   // 每秒补充令牌
}

export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: opts.capacity, last: now };
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

/** 计数器：N 时间窗口内最多 M 次。返回是否放行。 */
const counters = new Map<string, { count: number; resetAt: number }>();
export function fixedWindow(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const c = counters.get(key);
  if (!c || c.resetAt < now) {
    counters.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (c.count >= max) return false;
  c.count += 1;
  return true;
}
