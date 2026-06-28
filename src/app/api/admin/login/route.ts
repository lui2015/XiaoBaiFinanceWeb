import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiError, ErrorCode, jsonSafe } from '@/lib/api';
import { setAdminSession } from '@/lib/auth';
import { getClientIp } from '@/lib/utils';
import { writeOpLog } from '@/lib/op-log';

const schema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(64),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const { username, password } = schema.parse(await req.json().catch(() => ({})));
    const a = await prisma.adminUser.findUnique({ where: { username } });
    if (!a || a.status !== 1) throw new ApiError(ErrorCode.ACCOUNT_NOT_EXIST, '账号或密码错误', 401);
    if (a.lockedUntil && a.lockedUntil > new Date()) throw new ApiError(ErrorCode.ACCOUNT_LOCKED, '账号已被临时锁定', 423);
    const ok = await bcrypt.compare(password, a.passwordHash);
    if (!ok) {
      const failed = a.failedCount + 1;
      const locked = failed >= 5;
      await prisma.adminUser.update({
        where: { id: a.id },
        data: {
          failedCount: locked ? 0 : failed,
          lockedUntil: locked ? new Date(Date.now() + 10 * 60 * 1000) : a.lockedUntil,
        },
      });
      throw new ApiError(ErrorCode.PASSWORD_INVALID, '账号或密码错误', 401);
    }
    await prisma.adminUser.update({
      where: { id: a.id },
      data: { lastLoginAt: new Date(), lastLoginIp: getClientIp(req), failedCount: 0, lockedUntil: null },
    });
    await setAdminSession(a.id, a.role);
    await writeOpLog({ adminId: a.id, action: 'login', ip: getClientIp(req) });
    return jsonSafe({ id: String(a.id), username: a.username, role: a.role });
  });
}
