'use client';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toaster';
import { apiFetch } from '@/lib/http';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    toast('已退出登录', 'success');
    router.push('/');
    router.refresh();
  }
  return (
    <button onClick={logout} className="w-full bg-white border border-gray-200 py-2.5 rounded text-sm text-gray-600 hover:text-rose-500 hover:border-rose-200">
      退出登录
    </button>
  );
}
