'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toaster';
import { apiFetch } from '@/lib/http';

export default function SettingsClient({ user }: { user: { id: string; nickname: string; avatarUrl: string | null; phoneMasked: string | null; emailMasked: string | null } }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(user.nickname);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await apiFetch('/api/u/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, avatarUrl: avatarUrl || undefined }),
    });
    setSaving(false);
    const data = await r.json();
    if (!r.ok) return toast(data.message || '保存失败', 'error');
    toast('已保存', 'success');
    router.refresh();
  }

  async function cancelAccount() {
    if (!confirm('确认申请注销账号？将在 7 天后清理个人信息。')) return;
    const r = await apiFetch('/api/u/account/cancel', { method: 'POST' });
    if (r.ok) {
      toast('已提交注销申请', 'success');
      router.push('/');
      router.refresh();
    } else toast('提交失败', 'error');
  }

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">账号设置</h1>
      <div className="bg-white rounded-lg p-5 border border-gray-100 flex flex-col gap-3">
        <div>
          <label className="block text-sm text-gray-500 mb-1">昵称</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 outline-none focus:border-brand-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">头像 URL</label>
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..."
            className="w-full border border-gray-200 rounded px-3 py-2 outline-none focus:border-brand-500" />
        </div>
        <div className="text-sm text-gray-500 grid grid-cols-2 gap-3">
          <div>手机：<span className="text-gray-700">{user.phoneMasked || '未绑定'}</span></div>
          <div>邮箱：<span className="text-gray-700">{user.emailMasked || '未绑定'}</span></div>
        </div>
        <button disabled={saving} onClick={save} className="bg-brand-500 hover:bg-brand-600 text-white py-2 rounded disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>

      <Link
        href="/XiaoBaiFinance/me/settings/open-platform"
        className="bg-white rounded-lg p-5 border border-gray-100 mt-4 flex items-center justify-between hover:border-brand-300"
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-900">开放平台</h2>
          <p className="text-xs text-gray-500 mt-1">生成 API 密钥，让 AI 直接投稿；可复制提示词交给你的 AI 使用。</p>
        </div>
        <span className="text-brand-500 text-sm">进入 →</span>
      </Link>

      <div className="bg-white rounded-lg p-5 border border-gray-100 mt-4">
        <h2 className="text-sm font-semibold text-rose-500 mb-2">危险操作</h2>
        <p className="text-xs text-gray-500 mb-3">注销账号将进入 7 天冷静期，到期后清理个人信息，无法恢复。</p>
        <button onClick={cancelAccount} className="text-sm text-rose-500 border border-rose-200 px-4 py-1.5 rounded">
          注销账号
        </button>
      </div>
    </div>
  );
}
