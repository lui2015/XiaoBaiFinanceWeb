import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'node:path';

export const STATS_FILE = process.env.NODE_ENV === 'production'
  ? '/app/data/open-api-stats.json'
  : path.join(process.cwd(), 'data', 'open-api-stats.json');

export interface OpenStats {
  total: number;
  daily: Record<string, number>;
}

export function todayKey(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replace(/\//g, '-');
}

export async function readStats(): Promise<OpenStats> {
  try {
    return JSON.parse(await readFile(STATS_FILE, 'utf-8'));
  } catch {
    return { total: 0, daily: {} };
  }
}

/**
 * 累加一次开放接口调用（当日 + 累计）。
 * 用进程内队列串行化 read-modify-write，避免并发请求相互覆盖导致丢计数。
 */
let writeQueue: Promise<void> = Promise.resolve();

export function bumpStats(): Promise<void> {
  const job = writeQueue.then(async () => {
    const stats = await readStats();
    const day = todayKey();
    stats.total = (stats.total || 0) + 1;
    stats.daily = stats.daily || {};
    stats.daily[day] = (stats.daily[day] || 0) + 1;
    await mkdir(path.dirname(STATS_FILE), { recursive: true });
    await writeFile(STATS_FILE, JSON.stringify(stats), 'utf-8');
  });
  writeQueue = job.catch(() => { /* 让后续任务继续执行 */ });
  return job;
}
