/** 写入操作日志（管理员行为） */
import { prisma } from './prisma';

export async function writeOpLog(p: {
  adminId: number;
  action: string;
  targetType?: string;
  targetId?: string | number;
  payload?: unknown;
  ip?: string;
  ua?: string;
}) {
  await prisma.operationLog.create({
    data: {
      adminId: p.adminId,
      action: p.action,
      targetType: p.targetType,
      targetId: p.targetId !== undefined ? String(p.targetId) : undefined,
      payload: p.payload as any,
      ip: p.ip,
      ua: p.ua,
    },
  });
}
