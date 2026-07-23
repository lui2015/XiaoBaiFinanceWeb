import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiErrors, jsonSafe } from '@/lib/api';
import { sanitizeRichHtml, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { slugify } from '@/lib/utils';
import { getSearch } from '@/lib/search';
import { readStats, todayKey, STATS_FILE } from '@/lib/openStats';

const schema = z.object({
  title: z.string().min(2).max(60),
  summary: z.string().max(120).optional(),
  categoryId: z.string().regex(/^\d+$/),
  subCategoryId: z.string().regex(/^\d+$/).optional(),
  coverUrl: z.string().url().optional(),
  status: z.union([z.literal(0), z.literal(1)]).default(1),
  sourceType: z.union([z.literal(0), z.literal(1)]).default(0),
  contentHtml: z.string().optional(),
  contentMd: z.string().optional(),
});

async function uniqueSlug(title: string) {
  let base = slugify(title);
  let slug = base;
  let i = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/* ============ 调用统计（文件持久化） ============ */
async function bumpStats() {
  const fs = await import('fs/promises');
  const stats = await readStats();
  const day = todayKey();
  stats.total = (stats.total || 0) + 1;
  stats.daily = stats.daily || {};
  stats.daily[day] = (stats.daily[day] || 0) + 1;
  await fs.mkdir(STATS_FILE.replace(/\/[^/]+$/, ''), { recursive: true }).catch(() => {});
  await fs.writeFile(STATS_FILE, JSON.stringify(stats), 'utf-8');
}

/** 从环境变量或文件读取合法 API Key 列表 */
async function getValidKeys(): Promise<Set<string>> {
  const envKey = process.env.OPEN_API_KEY;
  const keys = new Set<string>();
  if (envKey) keys.add(envKey.trim());
  // 也支持从 data/open-api-keys.txt 每行一个 key
  try {
    const fs = await import('fs/promises');
    const raw = await fs.readFile('/app/data/open-api-keys.txt', 'utf-8').catch(() => '');
    raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(k => keys.add(k));
  } catch { /* ignore */ }
  return keys;
}

export async function POST(req: NextRequest) {
  try {
    // 鉴权：Bearer token 或 query param ?key=xxx
    let key = '';
    const auth = req.headers.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) key = m[1].trim();
    if (!key) key = new URL(req.url).searchParams.get('key') || '';
    if (!key) {
      return NextResponse.json({ code: 401, message: '缺少 API Key，请在 Header 中携带 Authorization: Bearer <key> 或参数?key=<key>' }, { status: 401 });
    }
    const validKeys = await getValidKeys();
    if (!validKeys.has(key)) {
      return NextResponse.json({ code: 403, message: 'API Key 无效' }, { status: 403 });
    }

    const body = schema.parse(await req.json().catch(() => ({})));
    let html = '';
    if (body.sourceType === 1) {
      if (!body.contentMd) throw ApiErrors.badRequest('contentMd 必填');
      html = markdownToSanitizedHtml(body.contentMd);
    } else {
      if (!body.contentHtml) throw ApiErrors.badRequest('contentHtml 必填');
      html = sanitizeRichHtml(body.contentHtml);
    }
    const text = htmlToText(html);
    if (!text.trim()) throw ApiErrors.badRequest('内容为空或被全部净化');
    const slug = await uniqueSlug(body.title);
    const summary = body.summary || text.slice(0, 120);
    const a = await prisma.article.create({
      data: {
        title: body.title,
        slug,
        summary,
        sourceType: body.sourceType,
        contentHtml: html,
        contentText: text,
        contentMd: body.sourceType === 1 ? body.contentMd : null,
        categoryId: Number(body.categoryId),
        subCategoryId: body.subCategoryId ? Number(body.subCategoryId) : null,
        coverUrl: body.coverUrl,
        status: body.status,
        createdBy: 1,
        publishAt: body.status === 1 ? new Date() : null,
      },
    });
    if (a.status === 1) {
      try { await getSearch().upsertArticle(a.id); } catch { /* no-op */ }
    }
    try { await bumpStats(); } catch { /* 统计失败不阻断主流程 */ }
    return NextResponse.json({ code: 0, data: { id: String(a.id), slug: a.slug }, message: 'ok' });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return NextResponse.json({ code: 400, message: '参数错误', details: e.errors }, { status: 400 });
    }
    if (e?.code && typeof e.message === 'string') {
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.code >= 400 && e.code < 600 ? e.code : 500 });
    }
    return NextResponse.json({ code: 500, message: '服务器内部错误' }, { status: 500 });
  }
}

/** GET 返回接口使用说明（供 AI / 开发者参考） */
export async function GET() {
  return NextResponse.json({
    code: 0,
    data: {
      name: '小白理财开放接口',
      version: 'v1',
      endpoint: '/api/open/articles',
      method: 'POST',
      auth: 'Bearer Token（API Key）',
      fields: [
        { name: 'title', type: 'string', required: true, desc: '标题，2-60字' },
        { name: 'summary', type: 'string', required: false, desc: '摘要，≤120字' },
        { name: 'categoryId', type: 'string', required: true, desc: '分类 ID（数字字符串）' },
        { name: 'subCategoryId', type: 'string', required: false, desc: '子分类 ID' },
        { name: 'coverUrl', type: 'string', required: false, desc: '封面图 URL' },
        { name: 'status', type: 'number', required: false, default: 1, desc: '0 草稿 / 1 发布' },
        { name: 'sourceType', type: 'number', required: false, default: 0, desc: '0 HTML / 1 Markdown' },
        { name: 'contentHtml', type: 'string', required: false, desc: 'HTML 正文（sourceType=0 时必填）' },
        { name: 'contentMd', type: 'string', required: false, desc: 'Markdown 正文（sourceType=1 时必填）' },
      ],
    },
  });
}
