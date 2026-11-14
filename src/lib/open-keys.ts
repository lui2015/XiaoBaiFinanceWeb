/**
 * 开放平台「文件式」API Key 的唯一存储入口。
 *
 * 生产环境落在容器 volume /app/data，开发环境落在项目 ./data。
 * 管理端生成/删除与开放接口校验必须共用本文件，避免出现「本地生成的 Key 读不到」的路径分叉。
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const KEYS_FILE = process.env.NODE_ENV === 'production'
  ? '/app/data/open-api-keys.txt'
  : path.join(process.cwd(), 'data', 'open-api-keys.txt');

export function generateOpenKey(): string {
  return `xb_open_${randomBytes(24).toString('base64url')}`;
}

export async function readOpenKeys(): Promise<string[]> {
  try {
    const raw = await readFile(KEYS_FILE, 'utf-8');
    return raw.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function writeOpenKeys(keys: string[]): Promise<void> {
  await mkdir(path.dirname(KEYS_FILE), { recursive: true });
  await writeFile(KEYS_FILE, [...new Set(keys)].join('\n') + '\n', 'utf-8');
}

/** 环境变量密钥（兼容单值 OPEN_API_KEY 与逗号分隔的 OPEN_API_KEYS） */
export function envOpenKeys(): string[] {
  const raw = [process.env.OPEN_API_KEY, process.env.OPEN_API_KEYS]
    .filter((v): v is string => Boolean(v))
    .join(',');
  return raw.split(',').map((k) => k.trim()).filter((k) => k.length >= 16);
}
