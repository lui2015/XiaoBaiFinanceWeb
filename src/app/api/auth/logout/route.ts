import { apiHandler } from '@/lib/api';
import { clearUserSession } from '@/lib/auth';

export async function POST() {
  return apiHandler(async () => {
    await clearUserSession();
    return { ok: true };
  });
}
