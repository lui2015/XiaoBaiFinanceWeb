/**
 * 加密与哈希工具
 * - phoneHash / emailHash：HMAC-SHA256（密钥来自 PII_ENC_KEY），用于唯一索引/查询
 * - phoneCipher：AES-256-GCM 加密，可解密用于业务读取
 */
import crypto from 'node:crypto';

function getKey(): Buffer {
  const k = process.env.PII_ENC_KEY || '';
  if (!k) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENC_KEY missing');
    }
    // 开发降级：用固定弱 key（仅本地开发）
    return crypto.createHash('sha256').update('dev-pii-key').digest();
  }
  // 支持 base64 或原始字符串
  try {
    const buf = Buffer.from(k, 'base64');
    if (buf.length === 32) return buf;
  } catch { /* ignore */ }
  return crypto.createHash('sha256').update(k).digest();
}

export function piiHash(plain: string): string {
  return crypto.createHmac('sha256', getKey()).update(plain).digest('hex');
}

export function aesGcmEncrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function aesGcmDecrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskPhone(phone: string) {
  if (!/^\d{11}$/.test(phone)) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}
export function maskEmail(email: string) {
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  return `${u.slice(0, 1)}***@${d}`;
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
