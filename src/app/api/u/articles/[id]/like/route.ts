import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { fixedWindow } from '@/lib/rate-limit';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const u = await requireUser();
    if (!/^\d+$/.test(params.id)) throw ApiErrors.badRequest();
    const articleId = BigInt(params.id);
    if (!fixedWindow(`like:${u.id}`, 10, 60)) throw ApiErrors.tooMany();
    const a = await prisma.article.findFirst({ where: { id: articleId, status: 1, deletedAt: null } });
    if (!a) throw ApiErrors.notFound('文章不存在');
    try {
      await prisma.userLike.create({ data: { userId: u.id, articleId } });
      await prisma.article.update({ where: { id: articleId }, data: { likeCount: { increment: 1 } } });
    } catch { /* 已点赞 -> 幂等 */ }
    return jsonSafe({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const u = await requireUser();
    if (!/^\d+$/.test(params.id)) throw ApiErrors.badRequest();
    const articleId = BigInt(params.id);
    const r = await prisma.userLike.deleteMany({ where: { userId: u.id, articleId } });
    if (r.count > 0) {
      await prisma.article.update({ where: { id: articleId }, data: { likeCount: { decrement: 1 } } });
    }
    return jsonSafe({ ok: true });
  });
}
