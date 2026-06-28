/** 微信网页扫码登录 - 进入授权 URL */
import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors } from '@/lib/api';

export async function GET(req: NextRequest) {
  const appId = process.env.WECHAT_OPEN_APP_ID;
  const redirect = process.env.WECHAT_OPEN_REDIRECT;
  if (!appId || !redirect) {
    // 未配置时返回提示页
    return NextResponse.json({ code: 1004, message: '微信登录未启用' }, { status: 404 });
  }
  const state = Math.random().toString(36).slice(2);
  const url =
    `https://open.weixin.qq.com/connect/qrconnect` +
    `?appid=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
  const resp = NextResponse.redirect(url);
  resp.cookies.set('xb_wx_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600 });
  return resp;
}
