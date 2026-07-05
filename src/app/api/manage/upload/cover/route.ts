import { NextRequest } from 'next/server';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { getStorage, makeUploadKey, checkImageMagic } from '@/lib/storage';

const MAX = 500 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) throw ApiErrors.badRequest('file 必填');
    if (!ALLOWED.includes(file.type)) throw ApiErrors.badRequest('文件类型不允许');
    if (file.size > MAX) throw ApiErrors.badRequest('文件超过 500KB');
    const buf = Buffer.from(await file.arrayBuffer());
    if (!checkImageMagic(buf, file.type)) throw ApiErrors.badRequest('文件内容与扩展名不符');
    const key = makeUploadKey('cover', file.name);
    const r = await getStorage().put(key, buf, file.type);
    return jsonSafe(r);
  });
}
