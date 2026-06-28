/**
 * 对象存储抽象
 * - local：本地磁盘（开发）
 * - cos：腾讯云对象存储
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface UploadResult { url: string; key: string; size: number; contentType: string }
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<UploadResult>;
}

class LocalStorage implements Storage {
  private dir = process.env.LOCAL_UPLOAD_DIR || './uploads';
  async put(key: string, body: Buffer, contentType: string) {
    const full = path.join(this.dir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { url: `/uploads/${key}`, key, size: body.length, contentType };
  }
}

class CosStorage implements Storage {
  async put(key: string, body: Buffer, contentType: string) {
    const COSMod: any = await import('cos-nodejs-sdk-v5');
    const COS = COSMod.default || COSMod;
    const cos = new COS({ SecretId: process.env.COS_SECRET_ID, SecretKey: process.env.COS_SECRET_KEY });
    await new Promise<void>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION,
          Key: key,
          Body: body,
          ContentType: contentType,
        },
        (err: unknown) => (err ? reject(err) : resolve()),
      );
    });
    const base = process.env.COS_BASE_URL || `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`;
    return { url: `${base}/${key}`, key, size: body.length, contentType };
  }
}

let _instance: Storage | null = null;
export function getStorage(): Storage {
  if (_instance) return _instance;
  const provider = process.env.STORAGE_PROVIDER || 'local';
  _instance = provider === 'cos' ? new CosStorage() : new LocalStorage();
  return _instance;
}

export function makeUploadKey(prefix: string, original: string): string {
  const ext = path.extname(original).toLowerCase();
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const id = crypto.randomBytes(8).toString('hex');
  return `${prefix}/${y}/${m}/${id}${ext}`;
}

/** 文件类型/魔数校验 */
export const FileMagics: Record<string, string[]> = {
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'], // RIFF
  'image/gif': ['47494638'],
};
export function checkImageMagic(buf: Buffer, contentType: string): boolean {
  const list = FileMagics[contentType];
  if (!list) return false;
  const head = buf.subarray(0, 4).toString('hex');
  return list.some((m) => head.startsWith(m));
}
