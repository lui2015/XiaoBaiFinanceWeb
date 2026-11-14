import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, ApiErrors } from '@/lib/api';
import { sanitizeRichHtml, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { slugify } from '@/lib/utils';
import { getSearch } from '@/lib/search';
import { requireOpenApiKey, recordOpenCall } from '@/lib/open-auth';

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

export async function POST(req: NextRequest) {
  try {
    // 统一鉴权：兼容数据库密钥 xbk_live_ / 文件密钥 xb_open_ / 环境变量密钥
    // allowQuery 仅为兼容既有 ?key= 调用方；新接入方请使用请求头
    const ctx = await requireOpenApiKey(req, { allowQuery: true, scope: 'submit' });

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
    await recordOpenCall(ctx);
    return NextResponse.json({ code: 0, data: { id: String(a.id), slug: a.slug }, message: 'ok' });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ code: 400, message: '参数错误', details: e.errors }, { status: 400 });
    }
    if (e instanceof ApiError) {
      // 统一错误对象按 HTTP 状态码映射，避免业务码（1001 等）被误当成 HTTP 状态
      return NextResponse.json(
        { code: e.httpStatus, message: e.message, data: e.details ?? null },
        { status: e.httpStatus },
      );
    }
    if (typeof e?.code === 'number' && typeof e?.message === 'string') {
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.code >= 400 && e.code < 600 ? e.code : 500 });
    }
    return NextResponse.json({ code: 500, message: '服务器内部错误' }, { status: 500 });
  }
}

/** GET 返回接口使用说明（供 AI / 开发者参考，公开只读） */
export async function GET() {
  return NextResponse.json({
    code: 0,
    data: {
      name: '小白理财开放接口',
      version: 'v1',
      endpoint: '/api/open/articles',
      method: 'POST',
      auth: 'Authorization: Bearer <API_KEY> 或 X-API-Key: <API_KEY>',
      docs: '/api/open/docs?doc=data',
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
      dataEndpoints: [
        { method: 'GET', path: '/api/open/v1/articles', desc: '已发布文章列表（分页/筛选/搜索）' },
        { method: 'GET', path: '/api/open/v1/articles/{idOrSlug}', desc: '文章详情（含正文）' },
        { method: 'GET', path: '/api/open/v1/articles/{idOrSlug}/image', desc: '文章分享图（SVG 图片）' },
        { method: 'GET', path: '/api/open/v1/categories', desc: '分类树' },
      ],
    },
  });
}
