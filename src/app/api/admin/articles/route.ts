import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtmlContent, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { Reg, parsePage, slugify, getClientIp } from '@/lib/utils';
import { writeOpLog } from '@/lib/op-log';
import { getSearch } from '@/lib/search';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { page, size } = parsePage(sp);
    const status = sp.get('status');
    const keyword = sp.get('keyword');
    const where: any = { deletedAt: null };
    if (status !== null && status !== '') where.status = Number(status);
    if (keyword) where.title = { contains: keyword };
    const [list, total] = await Promise.all([
      prisma.article.findMany({
        where, orderBy: { id: 'desc' }, take: size, skip: (page - 1) * size,
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.article.count({ where }),
    ]);
    return jsonSafe({ list, total, page, size });
  });
}

const baseSchema = z.object({
  title: z.string().min(2).max(60),
  slug: z.string().regex(Reg.slug).optional(),
  summary: z.string().max(120).optional(),
  categoryId: z.string().regex(/^\d+$/),
  subCategoryId: z.string().regex(/^\d+$/).optional(),
  coverUrl: z.string().url().optional(),
  isRecommend: z.boolean().optional(),
  status: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  scheduledAt: z.string().datetime().optional(),
  // 内容三选一
  sourceType: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  contentHtml: z.string().optional(),
  contentMd: z.string().optional(),
  tagIds: z.array(z.string().regex(/^\d+$/)).max(5).optional(),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const body = baseSchema.parse(await req.json().catch(() => ({})));
    let html = '';
    if (body.sourceType === 0) {
      if (!body.contentHtml) throw ApiErrors.badRequest('contentHtml 必填');
      html = sanitizeHtmlContent(body.contentHtml);
    } else if (body.sourceType === 1) {
      if (!body.contentMd) throw ApiErrors.badRequest('contentMd 必填');
      html = markdownToSanitizedHtml(body.contentMd);
    } else {
      if (!body.contentHtml) throw ApiErrors.badRequest('contentHtml 必填');
      html = sanitizeHtmlContent(body.contentHtml);
    }
    const text = htmlToText(html);
    const slug = body.slug || slugify(body.title);
    const exist = await prisma.article.findUnique({ where: { slug } });
    if (exist) throw ApiErrors.conflict('slug 已存在');
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
        status: body.scheduledAt ? 0 : body.status,
        isRecommend: body.isRecommend ?? false,
        publishAt: body.status === 1 && !body.scheduledAt ? new Date() : null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        authorAdminId: admin.id,
      },
    });
    if (body.tagIds?.length) {
      await prisma.articleTag.createMany({
        data: body.tagIds.map(t => ({ articleId: a.id, tagId: BigInt(t) })),
        skipDuplicates: true,
      });
    }
    if (a.status === 1) await getSearch().upsertArticle(a.id);
    await writeOpLog({ adminId: admin.id, action: 'article.create', targetType: 'article', targetId: a.id, ip: getClientIp(req) });
    return jsonSafe({ id: String(a.id), slug: a.slug });
  });
}
