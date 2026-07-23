import { readFile } from 'fs/promises';

export const STATS_FILE = process.env.NODE_ENV === 'production'
  ? '/app/data/open-api-stats.json'
  : './data/open-api-stats.json';

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
