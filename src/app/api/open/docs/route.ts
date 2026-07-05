/**
 * 对外投稿接口的说明文档（公开只读）。
 * GET /api/open/docs  ->  返回 Markdown 纯文本，便于直接分享给人或交给 AI 阅读、生成调用代码。
 *
 * 安全说明：
 *  - 仅返回静态说明文档，不含任何密钥（Key 为 env-only，文档内全部是占位符）。
 *  - 读取的是固定路径文件，无任何用户输入拼接，不存在路径穿越（Path Traversal）风险。
 */
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 固定路径，随镜像一起拷贝（见 Dockerfile: COPY ... /app/docs）
const DOC_PATH = path.join(process.cwd(), 'docs', '对外投稿接口.md');

let cached: string | null = null;

async function loadDoc(): Promise<string> {
  // 生产环境文档随镜像固定，缓存到内存即可；开发环境不缓存，便于实时预览改动
  if (cached && process.env.NODE_ENV === 'production') return cached;
  cached = await readFile(DOC_PATH, 'utf-8');
  return cached;
}

export async function GET() {
  try {
    const md = await loadDoc();
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
