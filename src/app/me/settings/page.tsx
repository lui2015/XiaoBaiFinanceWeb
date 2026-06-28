import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login?returnTo=/me/settings');
  return (
    <SettingsClient user={{
      id: String(u.id),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      phoneMasked: u.phoneMasked,
      emailMasked: u.emailMasked,
    }} />
  );
}
