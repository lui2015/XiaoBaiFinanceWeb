import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { sanitizeRichHtml, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { slugify } from '@/lib/utils';
import { getSearch } from '@/lib/search';

const schema = z.object({
  title: z.string().min(2).max(60),
  summary: z.string().max(120).optional(),
  categoryId: z.string().regex(/^\d+$/),
  subCategoryId: z.string().regex(/^\d+$/).optional(),
  coverUrl: z.string().url().optional(),
  status: z.union([z.literal(0), z.literal(1)]).default(0),
  // 内容：0 HTML / 1 Markdown
  sourceType: z.union([z.literal(0), z.literal(1)]),
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

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 10));
    const keyword = (searchParams.get('keyword') || '').trim();
    const statusParam = searchParams.get('status');

    const where: any = { deletedAt: null };
    if (keyword) where.title = { contains: keyword };
    if (statusParam && /^[012]$/.test(statusParam)) where.status = parseInt(statusParam, 10);

    const [total, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, title: true, slug: true, status: true, viewCount: true,
          coverUrl: true, createdAt: true, publishAt: true, createdBy: true,
          category: { select: { name: true } },
          subCategory: { select: { name: true } },
        },
      }),
    ]);

    return jsonSafe({ list: rows, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
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
        categoryId: BigInt(body.categoryId),
        subCategoryId: body.subCategoryId ? BigInt(body.subCategoryId) : null,
        coverUrl: body.coverUrl,
        status: body.status,
        publishAt: body.status === 1 ? new Date() : null,
      },
    });
    if (a.status === 1) {
      try { await getSearch().upsertArticle(a.id); } catch { /* 搜索索引失败不阻断发布 */ }
    }
    return jsonSafe({ id: String(a.id), slug: a.slug });
  });
}
