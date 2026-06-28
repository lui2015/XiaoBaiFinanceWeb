import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiHandler, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  return apiHandler(async () => {
    await requireAdmin(2);
    const list = await prisma.adminUser.findMany({
      select: {
        id: true, username: true, realName: true, role: true, status: true,
        lastLoginAt: true, lastLoginIp: true, createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
    return jsonSafe(list);
  });
}

const schema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(64),
  role: z.union([z.literal(1), z.literal(2)]),
  realName: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin(2);
    const body = schema.parse(await req.json().catch(() => ({})));
    const a = await prisma.adminUser.create({
      data: {
        username: body.username,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
        realName: body.realName,
      },
    });
    return jsonSafe({ id: String(a.id), username: a.username });
  });
}
