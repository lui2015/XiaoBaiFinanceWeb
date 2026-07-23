import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { parsePage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const u = await requireUser();
    const { page, size } = parsePage(req.nextUrl.searchParams);
    const [list, total] = await Promise.all([
      prisma.userHistory.findMany({
        where: { userId: u.id },
        orderBy: { viewedAt: 'desc' },
        take: size, skip: (page - 1) * size,
        include: { article: { select: { id: true, title: true, slug: true, summary: true } } },
      }),
      prisma.userHistory.count({ where: { userId: u.id } }),
    ]);
    return jsonSafe({
      list: list.map(x => ({ ...x.article, viewedAt: x.viewedAt })),
      total, page, size,
    });
  });
}

export async function DELETE(req: NextRequest) {
  return apiHandler(async () => {
    const u = await requireUser();
    const id = req.nextUrl.searchParams.get('articleId');
    if (id) {
      await prisma.userHistory.deleteMany({ where: { userId: u.id, articleId: Number(id) } });
    } else {
      await prisma.userHistory.deleteMany({ where: { userId: u.id } });
    }
    return jsonSafe({ ok: true });
  });
}

const syncSchema = z.object({
  items: z.array(z.object({
    articleId: z.string().regex(/^\d+$/),
    viewedAt: z.number().int().optional(),
  })).max(50),
});

// sync local history -> cloud
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const u = await requireUser();
    const body = syncSchema.parse(await req.json().catch(() => ({})));
    for (const it of body.items) {
      await prisma.userHistory.upsert({
        where: { userId_articleId: { userId: u.id, articleId: Number(it.articleId) } },
        update: { viewedAt: it.viewedAt ? new Date(it.viewedAt) : new Date() },
        create: { userId: u.id, articleId: Number(it.articleId), viewedAt: it.viewedAt ? new Date(it.viewedAt) : new Date() },
      });
    }
    // 仅保留最近 200 条
    const olds = await prisma.userHistory.findMany({
      where: { userId: u.id },
      orderBy: { viewedAt: 'desc' },
      skip: 200, select: { id: true },
    });
    if (olds.length > 0) {
      await prisma.userHistory.deleteMany({ where: { id: { in: olds.map(o => o.id) } } });
    }
    return jsonSafe({ ok: true, synced: body.items.length });
  });
}
