import { apiHandler } from '@/lib/api';
import { clearAdminSession } from '@/lib/auth';

export async function POST() {
  return apiHandler(async () => {
    clearAdminSession();
    return { ok: true };
  });
}
