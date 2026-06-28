'use client';
import { useRouter } from 'next/navigation';

export default function AdminLogout() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin/login');
      }}
      className="px-2 py-1 border border-white/20 rounded text-xs hover:bg-white/10"
    >退出登录</button>
  );
}
