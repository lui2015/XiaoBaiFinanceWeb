import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiError, ErrorCode, jsonSafe } from '@/lib/api';
import { getClientIp, getUA } from '@/lib/utils';
import { setUserSession } from '@/lib/auth';

const schema = z.object({
  account: z.string().trim().min(1).max(40),
  password: z.string().min(6).max(64),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const { account, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { username: account } });
    if (!user || !user.passwordHash) throw new ApiError(ErrorCode.ACCOUNT_NOT_EXIST, '账号或密码错误', 401);
    if (user.status === 1) throw new ApiError(ErrorCode.ACCOUNT_BANNED, '账号已被封禁', 403);
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new ApiError(ErrorCode.ACCOUNT_LOCKED, '账号已被临时锁定', 423);

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedCount + 1;
      const locked = failed >= 5;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedCount: locked ? 0 : failed,
          lockedUntil: locked ? new Date(Date.now() + 10 * 60 * 1000) : user.lockedUntil,
        },
      });
      throw new ApiError(ErrorCode.PASSWORD_INVALID, '账号或密码错误', 401);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: getClientIp(req), failedCount: 0, lockedUntil: null },
    });
    await setUserSession(user.id, user.nickname, getUA(req), getClientIp(req));
    return jsonSafe({
      user: { id: String(user.id), nickname: user.nickname, avatarUrl: user.avatarUrl, emailMasked: user.emailMasked },
    });
  });
}
