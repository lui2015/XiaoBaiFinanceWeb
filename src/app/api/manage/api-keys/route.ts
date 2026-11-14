import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { generateOpenKey, readOpenKeys, writeOpenKeys, envOpenKeys } from '@/lib/open-keys';

export async function GET(_req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const allKeys = [...new Set([...envOpenKeys(), ...(await readOpenKeys())])];
    // 返回时脱敏展示；raw 供管理端复制（需管理员权限）
    return {
      keys: allKeys.map((k) => ({
        raw: k,
        masked: k.length > 12 ? k.slice(0, 8) + '****' + k.slice(-4) : '****',
      })),
    };
  });
}

export async function POST(_req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const newKey = generateOpenKey();
    const existing = await readOpenKeys();
    existing.push(newKey);
    await writeOpenKeys(existing);
    return { key: newKey, masked: newKey.slice(0, 8) + '****' + newKey.slice(-4) };
  });
}

export async function DELETE(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const target = (new URL(req.url).searchParams.get('key') || '').trim();
    if (!target) throw { code: 400, message: '缺少 key 参数' };
    const existing = await readOpenKeys();
    const filtered = existing.filter((k) => k !== target);
    if (filtered.length === existing.length) throw { code: 404, message: 'key 不存在（环境变量中的 key 无法删除）' };
    await writeOpenKeys(filtered);
    return { ok: true };
  });
}
