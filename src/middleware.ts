/**
 * 管理后台中间件：未登录跳到 /admin/login
 * 注意：admin/login 与 /api/admin/login 不拦截
 */
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin/:path*'],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();
  const at = req.cookies.get('xb_aat')?.value;
  if (!at) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
