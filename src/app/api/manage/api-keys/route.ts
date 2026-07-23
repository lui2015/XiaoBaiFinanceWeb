import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { apiHandler } from '@/lib/api';
import { requireManager } from '@/lib/auth';

const KEYS_FILE = process.env.NODE_ENV === 'production'
  ? '/app/data/open-api-keys.txt'
  : './data/open-api-keys.txt';

function generateKey(): string {
  return `xb_open_${randomBytes(24).toString('base64url')}`;
}

/** 读取所有已存储的 key */
async function readKeys(): Promise<string[]> {
  try {
    const fs = await import('fs/promises');
    const raw = await fs.readFile(KEYS_FILE, 'utf-8').catch(() => '');
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
  } catch { return []; }
}

/** 写入 key 列表 */
async function writeKeys(keys: string[]): Promise<void> {
  const fs = await import('fs/promises');
  await fs.mkdir(KEYS_FILE.replace(/\/[^/]+$/, ''), { recursive: true }).catch(() => {});
  await fs.writeFile(KEYS_FILE, keys.join('\n') + '\n', 'utf-8');
}

export async function GET(_req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const envKey = process.env.OPEN_API_KEY;
    const storedKeys = await readKeys();
    const allKeys = [...new Set([...(envKey ? [envKey] : []), ...storedKeys])];
    // 返回时脱敏
    return { keys: allKeys.map(k => ({ raw: k, masked: k.length > 12 ? k.slice(0, 8) + '****' + k.slice(-4) : '****' })) };
  });
}

export async function POST(_req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const newKey = generateKey();
    const existing = await readKeys();
    existing.push(newKey);
    await writeKeys(existing);
    return { key: newKey, masked: newKey.slice(0, 8) + '****' + newKey.slice(-4) };
  });
}

export async function DELETE(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const { searchParams } = new URL(req.url);
    const target = (searchParams.get('key') || '').trim();
    if (!target) throw { code: 400, message: '缺少 key 参数' };
    const existing = await readKeys();
    const filtered = existing.filter(k => k !== target);
    if (filtered.length === existing.length) throw { code: 404, message: 'key 不存在（环境变量中的 key 无法删除）' };
    await writeKeys(filtered);
    return { ok: true };
  });
}
