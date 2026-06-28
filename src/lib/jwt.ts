/**
 * JWT：Access Token（短期）+ Refresh Token（HttpOnly Cookie）
 */
import { SignJWT, jwtVerify } from 'jose';
import { ulid } from 'ulid';

const enc = new TextEncoder();
const accessSecret = () => enc.encode(process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-now');
const refreshSecret = () => enc.encode(process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-now');

const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL_SEC || 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL_SEC || 60 * 60 * 24 * 14);

export type Subject = 'user' | 'admin';
export interface AccessPayload { sub: string; sid: Subject; nick?: string; role?: number }
export interface RefreshPayload { sub: string; sid: Subject; jti: string }

export async function signAccess(p: AccessPayload) {
  return await new SignJWT({ ...p })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(accessSecret());
}

export async function signRefresh(sub: string, sid: Subject) {
  const jti = ulid();
  const token = await new SignJWT({ sid, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret());
  return { token, jti, expiresAt: new Date(Date.now() + REFRESH_TTL * 1000) };
}

export async function verifyAccess(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return payload as unknown as AccessPayload;
  } catch { return null; }
}

export async function verifyRefresh(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return { sub: String(payload.sub), sid: payload.sid as Subject, jti: String(payload.jti) };
  } catch { return null; }
}

export const TOKEN_TTL = { access: ACCESS_TTL, refresh: REFRESH_TTL };
