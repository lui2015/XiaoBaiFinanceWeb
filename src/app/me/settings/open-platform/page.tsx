import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import OpenPlatformClient from './OpenPlatformClient';

export const dynamic = 'force-dynamic';

export default async function OpenPlatformPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <OpenPlatformClient
      user={{ id: String(user.id), nickname: user.nickname || '用户' }}
    />
  );
}
