import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtmlContent, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { writeOpLog } from '@/lib/op-log';
import { getClientIp } from '@/lib/utils';
import { getSearch } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  title: z.string().min(2).max(60).optional(),
  summary: z.string().max(120).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  subCategoryId: z.string().regex(/^\d+$/).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  isRecommend: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  sourceType: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  contentHtml: z.string().optional(),
  contentMd: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAdmin();
    const a = await prisma.article.findUnique({
      where: { id: Number(params.id) },
      include: { tags: { include: { tag: true } } },
    });
    if (!a) throw ApiErrors.notFound();
    return jsonSafe(a);
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const id = Number(params.id);
    const body = updateSchema.parse(await req.json().catch(() => ({})));
    const data: any = {};
    if (body.title) data.title = body.title;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.categoryId) data.categoryId = Number(body.categoryId);
    if ('subCategoryId' in body) data.subCategoryId = body.subCategoryId ? Number(body.subCategoryId) : null;
    if ('coverUrl' in body) data.coverUrl = body.coverUrl;
    if (body.isRecommend !== undefined) data.isRecommend = body.isRecommend;
    if ('scheduledAt' in body) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

    if (body.sourceType !== undefined) {
      let html = '';
      if (body.sourceType === 0 || body.sourceType === 2) {
        if (!body.contentHtml) throw ApiErrors.badRequest('contentHtml 必填');
        html = sanitizeHtmlContent(body.contentHtml);
      } else {
        if (!body.contentMd) throw ApiErrors.badRequest('contentMd 必填');
        html = markdownToSanitizedHtml(body.contentMd);
      }
      data.sourceType = body.sourceType;
      data.contentHtml = html;
      data.contentText = htmlToText(html);
      data.contentMd = body.sourceType === 1 ? body.contentMd : null;
    }
    const a = await prisma.article.update({ where: { id }, data });
    if (a.status === 1) await getSearch().upsertArticle(a.id);
    await writeOpLog({ adminId: admin.id, action: 'article.update', targetType: 'article', targetId: id, ip: getClientIp(req) });
    return jsonSafe({ ok: true });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const id = Number(params.id);
    await prisma.article.update({ where: { id }, data: { deletedAt: new Date(), status: 2 } });
    await getSearch().removeArticle(id);
    await writeOpLog({ adminId: admin.id, action: 'article.delete', targetType: 'article', targetId: id, ip: getClientIp(req) });
    return jsonSafe({ ok: true });
  });
}
