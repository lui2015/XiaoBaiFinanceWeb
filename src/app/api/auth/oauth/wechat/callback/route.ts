/** 微信扫码回调：用 code 换 access_token、openid，自动注册/登录 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setUserSession } from '@/lib/auth';
import { getClientIp, getUA } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('xb_wx_state')?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/login?err=wx_state', req.url));
  }
  const appId = process.env.WECHAT_OPEN_APP_ID!;
  const secret = process.env.WECHAT_OPEN_APP_SECRET!;
  try {
    // 1) code -> access_token
    const tokenResp = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${secret}&code=${code}&grant_type=authorization_code`,
      { cache: 'no-store' },
    ).then(r => r.json() as Promise<{ access_token: string; openid: string; unionid?: string }>);
    if (!tokenResp.openid) return NextResponse.redirect(new URL('/login?err=wx_token', req.url));
    // 2) 拉取用户信息
    const info = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenResp.access_token}&openid=${tokenResp.openid}&lang=zh_CN`,
      { cache: 'no-store' },
    ).then(r => r.json() as Promise<{ nickname: string; headimgurl: string }>);
    let user = await prisma.user.findUnique({ where: { wechatOpenid: tokenResp.openid } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          wechatOpenid: tokenResp.openid,
          wechatUnionid: tokenResp.unionid,
          nickname: info.nickname || `微信用户_${tokenResp.openid.slice(-4)}`,
          avatarUrl: info.headimgurl,
        },
      });
    }
    if (user.status === 1) return NextResponse.redirect(new URL('/login?err=banned', req.url));
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: getClientIp(req) },
    });
    await setUserSession(user.id, user.nickname, getUA(req), getClientIp(req));
    return NextResponse.redirect(new URL('/me', req.url));
  } catch {
    return NextResponse.redirect(new URL('/login?err=wx', req.url));
  }
}
