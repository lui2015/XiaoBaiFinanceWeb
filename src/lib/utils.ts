/** 通用工具 */
import { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

export function getUA(req: NextRequest): string {
  return (req.headers.get('user-agent') || '').slice(0, 250);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `a-${Date.now().toString(36)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function parsePage(searchParams: URLSearchParams) {
  const page = clamp(Number(searchParams.get('page') || 1), 1, 10000);
  const size = clamp(Number(searchParams.get('size') || 20), 1, 50);
  return { page, size };
}

/** 校验 phone / email */
export const Reg = {
  phone: /^1[3-9]\d{9}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  password: /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/,
  slug: /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/,
};
