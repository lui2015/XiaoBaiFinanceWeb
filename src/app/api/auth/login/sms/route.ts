import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiError, ErrorCode, jsonSafe } from '@/lib/api';
import { Reg, getClientIp, getUA } from '@/lib/utils';
import { piiHash, aesGcmEncrypt, maskPhone } from '@/lib/crypto';
import { setUserSession } from '@/lib/auth';

const schema = z.object({
  phone: z.string().regex(Reg.phone),
  code: z.string().regex(/^\d{4,6}$/),
  agreement: z.boolean().refine((v) => v, '需同意用户协议与隐私政策'),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const { phone, code } = schema.parse(body);
    const phoneHash = piiHash(phone);

    const sms = await prisma.smsLog.findFirst({
      where: { phoneHash, used: false, expiredAt: { gt: new Date() } },
      orderBy: { id: 'desc' },
    });
    if (!sms) throw new ApiError(ErrorCode.SMS_CODE_EXPIRED, '验证码已过期或不存在', 400);
    const okCode = await bcrypt.compare(code, sms.codeHash);
    if (!okCode) throw new ApiError(ErrorCode.SMS_CODE_INVALID, '验证码错误', 400);
    await prisma.smsLog.update({ where: { id: sms.id }, data: { used: true } });

    let user = await prisma.user.findUnique({ where: { phoneHash } });
    if (!user) {
      const nickname = `小白用户_${phone.slice(-4)}`;
      user = await prisma.user.create({
        data: {
          phoneHash,
          phoneCipher: aesGcmEncrypt(phone),
          phoneMasked: maskPhone(phone),
          nickname,
        },
      });
    }
    if (user.status === 1) throw new ApiError(ErrorCode.ACCOUNT_BANNED, '账号已被封禁', 403);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: getClientIp(req), failedCount: 0 },
    });
    await setUserSession(user.id, user.nickname, getUA(req), getClientIp(req));
    return jsonSafe({
      user: {
        id: String(user.id),
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phoneMasked: user.phoneMasked,
      },
    });
  });
}
