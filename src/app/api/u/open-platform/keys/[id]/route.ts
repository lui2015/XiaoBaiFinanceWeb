/**
 * 开放平台密钥管理
 * DELETE /api/u/open-platform/keys/[id] -> 吊销密钥（仅可操作本人密钥）
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) throw ApiErrors.unauthorized('请先登录');

    const id = BigInt(params.id);
    const key = await prisma.openApiKey.findUnique({ where: { id }, select: { userId: true } });
    if (!key) throw ApiErrors.notFound('密钥不存在');
    if (key.userId !== user.id) throw ApiErrors.forbidden('无权操作该密钥');

    await prisma.openApiKey.delete({ where: { id } });
    return jsonSafe({ ok: true });
  });
}
