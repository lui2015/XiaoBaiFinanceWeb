/**
 * 开放平台投稿接口
 * POST /api/open/articles
 *
 * 鉴权：需要开放平台 API Key（在「设置-开放平台」中生成）。
 *   通过 Authorization: Bearer <key> 或 x-api-key: <key> 携带。
 *   每次成功调用都会计入该用户「当日 / 累计」调用次数。
 * 行为：投稿内容经安全净化后「直接发布」（status=1），无需人工审核即对外可见。
 * 安全策略：
 *  - 内容强制净化（防 XSS）；
 *  - 按来源 IP + API Key 双重限流；
 *  - 分类必须存在且启用；
 *  - slug 冲突自动追加随机后缀，避免因重名报错。
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { sanitizeRichHtml, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';
import { slugify, getClientIp, getUA, Reg } from '@/lib/utils';
import { fixedWindow } from '@/lib/rate-limit';
import { getSearch } from '@/lib/search';
import { resolveOpenApiKey, recordOpenApiCall } from '@/lib/open-api';

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

    // 开放平台鉴权：解析并校验 API Key（无效/停用 -> 401）
    const key = await resolveOpenApiKey(req);

    // 双重限流：来源 IP + API Key
    if (!fixedWindow(`open:submit:ip:${ip}`, 20, 60)) {
      throw ApiErrors.tooMany('提交过于频繁，请稍后再试');
    }
    if (!fixedWindow(`open:submit:key:${key.id}`, 60, 60)) {
      throw ApiErrors.tooMany('该密钥调用过于频繁，请稍后再试');
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
      // 与前台「我的-管理」上传路径一致：使用 sanitizeRichHtml「原样保留」原始 HTML
      // 格式（<style>/内联 style/class/布局标签/表格等），仅剔除 XSS 危险内容
      // （<script>、on* 事件、javascript:/vbscript:/data:text/html）。
      // 渲染侧对 sourceType=0 用 sandbox iframe（无 allow-same-origin）隔离，形成纵深防御。
      html = sanitizeRichHtml(body.contentHtml);
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
        status: 1, // 对外投稿直接发布
        publishAt: new Date(),
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

    // 审计留痕（记录开放平台用户与密钥）
    await prisma.operationLog.create({
      data: {
        action: 'open.article.submit',
        targetType: 'article',
        targetId: String(article.id),
        payload: JSON.stringify({
          source: 'open-api',
          keyId: String(key.id),
          userId: String(key.userId),
          title: body.title,
          published: true,
        }),
        ip,
        ua: getUA(req),
      },
    });

    // 计入开放平台调用统计（当日 + 累计）
    await recordOpenApiCall(key.userId, key.id);

    // 已发布：同步搜索索引（失败不阻断发布）
    try {
      await getSearch().upsertArticle(article.id);
    } catch {
      /* 搜索索引失败不影响文章发布 */
    }

    return jsonSafe({
      id: String(article.id),
      slug: article.slug,
      status: article.status, // 1 = 已发布
      message: '投稿已发布',
    });
  });
}
