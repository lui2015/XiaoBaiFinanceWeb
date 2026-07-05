import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { sanitizeRichHtml, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { getSearch } from '@/lib/search';

const updateSchema = z.object({
  title: z.string().min(2).max(60).optional(),
  summary: z.string().max(120).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  subCategoryId: z.string().regex(/^\d+$/).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  // 内容：0 HTML / 1 Markdown
  sourceType: z.union([z.literal(0), z.literal(1)]).optional(),
  contentHtml: z.string().optional(),
  contentMd: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireManager();
    const a = await prisma.article.findFirst({
      where: { id: BigInt(params.id), deletedAt: null },
    });
    if (!a) throw ApiErrors.notFound();
    return jsonSafe(a);
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireManager();
    const id = BigInt(params.id);
    const exists = await prisma.article.findFirst({ where: { id, deletedAt: null } });
    if (!exists) throw ApiErrors.notFound();

    const body = updateSchema.parse(await req.json().catch(() => ({})));
    const data: any = {};
    if (body.title) data.title = body.title;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.categoryId) data.categoryId = BigInt(body.categoryId);
    if ('subCategoryId' in body) data.subCategoryId = body.subCategoryId ? BigInt(body.subCategoryId) : null;
    if ('coverUrl' in body) data.coverUrl = body.coverUrl;

    if (body.sourceType !== undefined) {
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
      data.sourceType = body.sourceType;
      data.contentHtml = html;
      data.contentText = text;
      data.contentMd = body.sourceType === 1 ? body.contentMd : null;
    }

    if (body.status !== undefined) {
      data.status = body.status;
      // 首次发布时补充发布时间
      if (body.status === 1 && !exists.publishAt) data.publishAt = new Date();
    }

    const a = await prisma.article.update({ where: { id }, data });
    try {
      if (a.status === 1) await getSearch().upsertArticle(a.id);
      else await getSearch().removeArticle(a.id);
    } catch { /* 搜索索引失败不阻断保存 */ }
    return jsonSafe({ id: String(a.id), slug: a.slug });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireManager();
    const id = BigInt(params.id);
    const exists = await prisma.article.findFirst({ where: { id, deletedAt: null } });
    if (!exists) throw ApiErrors.notFound();
    await prisma.article.update({ where: { id }, data: { deletedAt: new Date(), status: 2 } });
    try { await getSearch().removeArticle(id); } catch { /* ignore */ }
    return jsonSafe({ ok: true });
  });
}
