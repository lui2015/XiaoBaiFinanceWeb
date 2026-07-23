/**
 * 鉴权辅助：从 Cookie 获取 Access Token，无效则尝试 Refresh
 */
import { cookies } from 'next/headers';
import { signAccess, signRefresh, verifyAccess, verifyRefresh, TOKEN_TTL } from './jwt';
import { prisma } from './prisma';
import { ApiErrors } from './api';

const COOKIE_USER_AT = 'xb_uat';
const COOKIE_USER_RT = 'xb_urt';
const COOKIE_ADMIN_AT = 'xb_aat';
const COOKIE_ADMIN_RT = 'xb_art';

export const AuthCookies = {
  user: { at: COOKIE_USER_AT, rt: COOKIE_USER_RT },
  admin: { at: COOKIE_ADMIN_AT, rt: COOKIE_ADMIN_RT },
};

// 仅在显式开启 HTTPS 时才给 Cookie 加 secure（HTTP 部署必须关闭，否则浏览器会丢弃 Cookie 导致“登录成功却未登录”）
function cookieSecure() { return process.env.COOKIE_SECURE === 'true'; }

export async function setUserSession(userId: bigint, nickname: string, ua?: string, ip?: string) {
  const sub = String(userId);
  const at = await signAccess({ sub, sid: 'user', nick: nickname });
  const { token: rt, jti, expiresAt } = await signRefresh(sub, 'user');
  await prisma.refreshToken.create({ data: { userId, jti, ua, ip, expiredAt: expiresAt } });
  const c = cookies();
  c.set(COOKIE_USER_AT, at, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: TOKEN_TTL.access });
  c.set(COOKIE_USER_RT, rt, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: TOKEN_TTL.refresh });
  return { at, rt };
}

export async function setAdminSession(adminId: bigint, role: number) {
  const sub = String(adminId);
  const at = await signAccess({ sub, sid: 'admin', role });
  const { token: rt, expiresAt: _ea } = await signRefresh(sub, 'admin');
  void _ea;
  const c = cookies();
  c.set(COOKIE_ADMIN_AT, at, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: TOKEN_TTL.access });
  c.set(COOKIE_ADMIN_RT, rt, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: TOKEN_TTL.refresh });
  return { at, rt };
}

export async function clearUserSession() {
  const c = cookies();
  const rt = c.get(COOKIE_USER_RT)?.value;
  if (rt) {
    const p = await verifyRefresh(rt);
    if (p) await prisma.refreshToken.updateMany({ where: { jti: p.jti }, data: { revoked: true } });
  }
  c.delete(COOKIE_USER_AT); c.delete(COOKIE_USER_RT);
}
export function clearAdminSession() {
  const c = cookies();
  c.delete(COOKIE_ADMIN_AT); c.delete(COOKIE_ADMIN_RT);
}

export async function getCurrentUser() {
  const c = cookies();
  const at = c.get(COOKIE_USER_AT)?.value;
  if (at) {
    const p = await verifyAccess(at);
    if (p && p.sid === 'user') {
      const u = await prisma.user.findUnique({ where: { id: BigInt(p.sub) } });
      if (u && u.status === 0) return u;
    }
  }
  // 尝试 refresh
  const rt = c.get(COOKIE_USER_RT)?.value;
  if (rt) {
    const p = await verifyRefresh(rt);
    if (p && p.sid === 'user') {
      const stored = await prisma.refreshToken.findUnique({ where: { jti: p.jti } });
      if (stored && !stored.revoked && stored.expiredAt > new Date()) {
        const u = await prisma.user.findUnique({ where: { id: BigInt(p.sub) } });
        if (u && u.status === 0) {
          const newAt = await signAccess({ sub: p.sub, sid: 'user', nick: u.nickname });
          // 在服务端组件渲染阶段无法修改 Cookie，此时忽略「顺带刷新」，不影响返回用户
          try {
            c.set(COOKIE_USER_AT, newAt, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: TOKEN_TTL.access });
          } catch {
            // ignore: cookies can only be modified in a Server Action or Route Handler
          }
          return u;
        }
      }
    }
  }
  return null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw ApiErrors.unauthorized();
  return u;
}

/** 前台管理员：已登录用户 且 isAdmin=true，否则 401/403 */
export async function requireManager() {
  const u = await getCurrentUser();
  if (!u) throw ApiErrors.unauthorized();
  if (!u.isAdmin) throw ApiErrors.forbidden();
  return u;
}

export async function getCurrentAdmin() {
  const c = cookies();
  const at = c.get(COOKIE_ADMIN_AT)?.value;
  if (!at) return null;
  const p = await verifyAccess(at);
  if (!p || p.sid !== 'admin') return null;
  const a = await prisma.adminUser.findUnique({ where: { id: BigInt(p.sub) } });
  if (!a || a.status !== 1) return null;
  return a;
}

export async function requireAdmin(minRole: 1 | 2 = 1) {
  const a = await getCurrentAdmin();
  if (!a) throw ApiErrors.unauthorized();
  if (a.role < minRole) throw ApiErrors.forbidden();
  return a;
}
