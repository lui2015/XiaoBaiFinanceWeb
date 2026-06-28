import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, ErrorCode, ApiError, jsonSafe } from '@/lib/api';
import { Reg, getClientIp } from '@/lib/utils';
import { piiHash } from '@/lib/crypto';
import { fixedWindow } from '@/lib/rate-limit';
import { getSms } from '@/lib/sms';

const sendSchema = z.object({
  phone: z.string().regex(Reg.phone, '手机号格式错误'),
  scene: z.enum(['login', 'bind', 'reset']).default('login'),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const { phone, scene } = sendSchema.parse(body);
    const ip = getClientIp(req);
    const phoneHash = piiHash(phone);

    // 60s 冷却
    if (!fixedWindow(`sms:cool:${phoneHash}`, 1, 60)) {
      throw new ApiError(ErrorCode.SMS_RATE_LIMITED, '发送过于频繁，请稍候再试', 429);
    }
    // 单日 10 条
    if (!fixedWindow(`sms:day:${phoneHash}`, 10, 86400)) {
      throw new ApiError(ErrorCode.SMS_DAILY_LIMITED, '今日发送次数已达上限', 429);
    }
    // IP 维度：1 小时 ≥ 20 触发图形验证码（这里简化为 30 直接拦截）
    if (!fixedWindow(`sms:ip:${ip}`, 30, 3600)) {
      throw new ApiError(ErrorCode.CAPTCHA_REQUIRED, '请完成图形验证后再试', 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 8);
    await prisma.smsLog.create({
      data: {
        phoneHash,
        scene,
        codeHash,
        ip,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await getSms().sendOtp(phone, code);
    return jsonSafe({ ok: true, ttlSec: 300 });
  });
}
