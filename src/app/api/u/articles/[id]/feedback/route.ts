import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe, ApiErrors } from '@/lib/api';
import { requireUser } from '@/lib/auth';

const schema = z.object({
  type: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  content: z.string().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const u = await requireUser();
    if (!/^\d+$/.test(params.id)) throw ApiErrors.badRequest();
    const articleId = BigInt(params.id);
    const body = schema.parse(await req.json().catch(() => ({})));
    if (body.type === 2 && !body.content) throw ApiErrors.badRequest('请填写报错描述');
    const a = await prisma.article.findFirst({ where: { id: articleId, status: 1, deletedAt: null } });
    if (!a) throw ApiErrors.notFound('文章不存在');
    const fb = await prisma.userFeedback.create({
      data: { userId: u.id, articleId, type: body.type, content: body.content },
    });
    return jsonSafe({ id: String(fb.id) });
  });
}
