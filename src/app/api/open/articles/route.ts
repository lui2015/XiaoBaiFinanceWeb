/**
 * 对外开放投稿接口
 * POST /api/open/articles
 *
 * 鉴权：无需鉴权（公开接口，任何人可调用）。
 * 安全策略（无鉴权，故防滥用全靠以下几道）：
 *  - 内容强制净化（防 XSS）；
 *  - 投稿一律落库为「草稿 / 待审核」（status=0），不允许对外直接发布，必须人工审核；
 *  - 按来源 IP 限流（较严格）；
 *  - 分类必须存在且启用；
 *  - slug 冲突自动追加随机后缀，避免因重名报错。
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { sanitizeHtmlContent, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { slugify, getClientIp, getUA, Reg } from '@/lib/utils';
import { fixedWindow } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const submitSchema = z
  .object({
    title: z.string().min(2).max(60),
    slug: z.string().regex(Reg.slug).optional(),
    summary: z.string().max(120).optional(),
    coverUrl: z.string().url().max(255).optional(),
    // 分类：id 或 slug 二选一
    categoryId: z.string().regex(/^\d+$/).optional(),
    categorySlug: z.string().max(60).optional(),
    subCategoryId: z.string().regex(/^\d+$/).optional(),
    // 0 = HTML（默认），1 = Markdown
    sourceType: z.union([z.literal(0), z.literal(1)]).default(0),
    contentHtml: z.string().max(200_000).optional(),
    contentMd: z.string().max(200_000).optional(),
    // 标签名称（非 id），最多 5 个，服务端自动创建
    tags: z.array(z.string().min(1).max(40)).max(5).optional(),
  })
  .refine((d) => !!d.categoryId || !!d.categorySlug, {
    message: '需要提供 categoryId 或 categorySlug',
    path: ['categoryId'],
  });

/** 生成唯一 slug：优先使用入参，冲突时追加短随机后缀。 */
async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const exist = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
    if (!exist) return slug;
    const suffix = crypto.randomBytes(3).toString('hex');
    slug = `${base.slice(0, 52)}-${suffix}`;
  }
  // 极端兜底
  return `${base.slice(0, 44)}-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const ip = getClientIp(req);

    // 无鉴权公开接口：仅按来源 IP 限流（较严格），配合强制草稿待审，降低匿名滥用风险
    if (!fixedWindow(`open:submit:ip:${ip}`, 20, 60)) {
      throw ApiErrors.tooMany('提交过于频繁，请稍后再试');
    }

    const body = submitSchema.parse(await req.json().catch(() => ({})));

    // 解析并校验分类
    let categoryId: bigint;
    if (body.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: BigInt(body.categoryId) }, select: { id: true, status: true } });
      if (!cat || cat.status !== 1) throw ApiErrors.badRequest('分类不存在或未启用');
      categoryId = cat.id;
    } else {
      const cat = await prisma.category.findUnique({ where: { slug: body.categorySlug! }, select: { id: true, status: true } });
      if (!cat || cat.status !== 1) throw ApiErrors.badRequest('分类不存在或未启用');
      categoryId = cat.id;
    }

    let subCategoryId: bigint | null = null;
    if (body.subCategoryId) {
      const sub = await prisma.category.findUnique({ where: { id: BigInt(body.subCategoryId) }, select: { id: true, status: true } });
      if (!sub || sub.status !== 1) throw ApiErrors.badRequest('子分类不存在或未启用');
      subCategoryId = sub.id;
    }

    // 内容净化
    let html = '';
    if (body.sourceType === 1) {
      if (!body.contentMd) throw ApiErrors.badRequest('contentMd 必填');
      html = markdownToSanitizedHtml(body.contentMd);
    } else {
      if (!body.contentHtml) throw ApiErrors.badRequest('contentHtml 必填');
      html = sanitizeHtmlContent(body.contentHtml);
    }
    const text = htmlToText(html);
    if (!text.trim()) throw ApiErrors.badRequest('正文内容为空或被安全过滤');

    const slug = await ensureUniqueSlug(body.slug || slugify(body.title));
    const summary = body.summary || text.slice(0, 120);

    const article = await prisma.article.create({
      data: {
        title: body.title,
        slug,
        summary,
        sourceType: body.sourceType,
        contentHtml: html,
        contentText: text,
        contentMd: body.sourceType === 1 ? body.contentMd : null,
        categoryId,
        subCategoryId,
        coverUrl: body.coverUrl,
        status: 0, // 对外投稿一律为草稿，待管理员审核后发布
        isRecommend: false,
        authorAdminId: null,
      },
      select: { id: true, slug: true, status: true },
    });

    // 处理标签（名称 -> upsert）
    if (body.tags?.length) {
      const uniqueNames = Array.from(new Set(body.tags.map((t) => t.trim()).filter(Boolean)));
      for (const name of uniqueNames) {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name, slug: slugify(name) },
          select: { id: true },
        });
        await prisma.articleTag.createMany({
          data: [{ articleId: article.id, tagId: tag.id }],
          skipDuplicates: true,
        });
      }
    }

    // 审计留痕（adminId 留空，表示来自对外接口）
    await prisma.operationLog.create({
      data: {
        action: 'open.article.submit',
        targetType: 'article',
        targetId: String(article.id),
        payload: { source: 'open-api', title: body.title },
        ip,
        ua: getUA(req),
      },
    });

    return jsonSafe({
      id: String(article.id),
      slug: article.slug,
      status: article.status, // 0 = 待审核
      message: '投稿已提交，等待管理员审核后发布',
    });
  });
}
