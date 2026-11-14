/**
 * 开放接口说明文档（公开只读）。
 * GET /api/open/docs            -> 投稿接口文档（兼容旧链接）
 * GET /api/open/docs?doc=data   -> 开放平台完整文档（数据读取 + 投稿）
 *
 * 安全说明：
 *  - 仅返回白名单内的静态文档，不含任何密钥（文档内全部是占位符）。
 *  - 文档名由枚举映射为固定绝对路径，无任何用户输入拼接，不存在路径穿越风险。
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 固定路径，随镜像一起拷贝（见 Dockerfile: COPY ... /app/docs）
const DOCS = {
  submit: path.join(process.cwd(), 'docs', '对外投稿接口.md'),
  data: path.join(process.cwd(), 'docs', '开放数据接口.md'),
} as const;
type DocKey = keyof typeof DOCS;

const cache = new Map<DocKey, string>();

async function loadDoc(key: DocKey): Promise<string> {
  // 生产环境文档随镜像固定，缓存到内存即可；开发环境不缓存，便于实时预览改动
  if (process.env.NODE_ENV === 'production') {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const md = await readFile(DOCS[key], 'utf-8');
  cache.set(key, md);
  return md;
}

export async function GET(req: NextRequest) {
  const key: DocKey = req.nextUrl.searchParams.get('doc') === 'data' ? 'data' : 'submit';
  try {
    const md = await loadDoc(key);
    return new NextResponse(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new NextResponse('# 文档暂不可用\n请稍后重试或联系管理员。', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
