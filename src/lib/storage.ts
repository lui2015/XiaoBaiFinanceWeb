/**
 * 统一对象存储抽象
 * - local：本地磁盘（开发）
 * - cos ：腾讯云 COS（生产）—— 平台/API 上传的文件统一落到这里
 *
 * 凭证来源优先级：
 *   1) 数据卷配置文件（默认 /app/data/cos-config.json）
 *      —— 线上无需重建容器，把配置放进已挂载的 data 卷后 restart 即可生效
 *   2) 环境变量 STORAGE_PROVIDER / COS_*
 *
 * cos-config.json 示例（切勿提交到仓库）：
 *   {
 *     "enabled": true,
 *     "region": "ap-guangzhou",
 *     "bucket": "lyman-1258661753",
 *     "secretId": "...",
 *     "secretKey": "...",
 *     "prefix": "xiaobai"
 *   }
 */
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface UploadResult { url: string; key: string; size: number; contentType: string }
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<UploadResult>;
}

interface CosOptions {
  enabled: boolean;
  region: string;
  bucket: string;
  secretId: string;
  secretKey: string;
  baseUrl?: string;
  prefix: string;
}

const DEFAULT_COS_CONFIG = '/app/data/cos-config.json';

let _cosOptions: CosOptions | null = null;

function resolveCosOptions(): CosOptions {
  if (_cosOptions) return _cosOptions;
  const opts: CosOptions = {
    enabled: process.env.STORAGE_PROVIDER === 'cos',
    region: process.env.COS_REGION || 'ap-guangzhou',
    bucket: process.env.COS_BUCKET || '',
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
    baseUrl: process.env.COS_BASE_URL || undefined,
    prefix: process.env.COS_PREFIX || 'xiaobai',
  };
  const cfgPath = process.env.COS_CONFIG_FILE || DEFAULT_COS_CONFIG;
  try {
    const disk = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    if (typeof disk.enabled === 'boolean') opts.enabled = disk.enabled;
    if (disk.region) opts.region = disk.region;
    if (disk.bucket) opts.bucket = disk.bucket;
    if (disk.secretId) opts.secretId = disk.secretId;
    if (disk.secretKey) opts.secretKey = disk.secretKey;
    if (disk.baseUrl) opts.baseUrl = disk.baseUrl;
    if (disk.prefix) opts.prefix = disk.prefix;
  } catch {
    // 配置文件不存在/不可读时回退到环境变量
  }
  _cosOptions = opts;
  return opts;
}

/** 当前是否使用 COS 作为存储后端（供健康检查/调试） */
export function isCosEnabled(): boolean {
  return resolveCosOptions().enabled;
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
  private cosPromise: Promise<any> | null = null;
  private async client(opts: CosOptions) {
    if (!this.cosPromise) {
      this.cosPromise = (async () => {
        const COSMod: any = await import('cos-nodejs-sdk-v5');
        const COS = COSMod.default || COSMod;
        return new COS({ SecretId: opts.secretId, SecretKey: opts.secretKey });
      })();
    }
    return this.cosPromise;
  }
  private fullKey(key: string, opts: CosOptions): string {
    const k = key.replace(/^\/+/, '');
    const p = opts.prefix.replace(/^\/+|\/+$/g, '');
    return p ? `${p}/${k}` : k;
  }
  async put(key: string, body: Buffer, contentType: string) {
    const opts = resolveCosOptions();
    if (!opts.bucket || !opts.secretId || !opts.secretKey) {
      throw new Error('COS 配置不完整：需要 bucket / secretId / secretKey');
    }
    const cos = await this.client(opts);
    const fullKey = this.fullKey(key, opts);
    await new Promise<void>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: opts.bucket,
          Region: opts.region,
          Key: fullKey,
          Body: body,
          ContentType: contentType,
        },
        (err: unknown) => (err ? reject(err) : resolve()),
      );
    });
    const base = (opts.baseUrl || `https://${opts.bucket}.cos.${opts.region}.myqcloud.com`).replace(/\/+$/, '');
    return { url: `${base}/${fullKey}`, key: fullKey, size: body.length, contentType };
  }
}

let _instance: Storage | null = null;
export function getStorage(): Storage {
  if (_instance) return _instance;
  _instance = resolveCosOptions().enabled ? new CosStorage() : new LocalStorage();
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

/** 把本地文件读取后交给统一存储层上传（供 Python 生成的卡片图等使用） */
export async function uploadLocalFile(key: string, filePath: string, contentType: string): Promise<UploadResult> {
  const body = await fs.readFile(filePath);
  return getStorage().put(key, body, contentType);
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
