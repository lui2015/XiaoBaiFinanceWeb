'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/components/Toaster';

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get('returnTo') || '/me';
  const [tab, setTab] = useState<'sms' | 'password'>('sms');
  // SMS
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [counting, setCounting] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function sendCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('请输入正确的手机号', 'error');
    const r = await fetch('/api/auth/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, scene: 'login' }),
    });
    const data = await r.json();
    if (!r.ok) return toast(data.message || '发送失败', 'error');
    toast('验证码已发送', 'success');
    setCounting(60);
    const t = setInterval(() => {
      setCounting((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function loginSms() {
    if (!agree) return toast('请先勾选同意协议', 'error');
    setSubmitting(true);
    const r = await fetch('/api/auth/login/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, agreement: true }),
    });
    setSubmitting(false);
    const data = await r.json();
    if (!r.ok) return toast(data.message || '登录失败', 'error');
    toast('登录成功', 'success');
    // 同步本地历史 -> 云端
    try {
      const local = JSON.parse(localStorage.getItem('xb_history') || '[]') as { id: string; at: number }[];
      if (local.length) {
        await fetch('/api/u/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: local.slice(0, 50).map(x => ({ articleId: x.id, viewedAt: x.at })) }),
        });
      }
    } catch { /* ignore */ }
    router.push(returnTo);
    router.refresh();
  }

  async function loginEmail() {
    setSubmitting(true);
    const r = await fetch('/api/auth/login/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    const data = await r.json();
    if (!r.ok) return toast(data.message || '登录失败', 'error');
    toast('登录成功', 'success');
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[420px] p-4 sm:p-8">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h1 className="text-2xl font-bold mb-1">欢迎回来</h1>
        <p className="text-sm text-gray-500 mb-5">登录后可使用收藏、点赞、反馈等功能</p>
        <div className="flex gap-3 mb-4 border-b border-gray-100">
          {([['sms','手机号'], ['password','邮箱密码']] as const).map(([k, l]) => (
            <button key={k}
              onClick={() => setTab(k as 'sms' | 'password')}
              className={`pb-2 text-sm ${tab === k ? 'border-b-2 border-brand-500 text-brand-500' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>

        {tab === 'sms' ? (
          <div className="flex flex-col gap-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号"
              className="border border-gray-200 rounded px-3 py-2.5 outline-none focus:border-brand-500" />
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码"
                className="flex-1 border border-gray-200 rounded px-3 py-2.5 outline-none focus:border-brand-500" />
              <button disabled={counting > 0} onClick={sendCode}
                className="px-3 py-2 border border-brand-500 text-brand-500 rounded text-sm disabled:opacity-50 disabled:border-gray-200 disabled:text-gray-400">
                {counting > 0 ? `${counting}s` : '发送验证码'}
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
              <span>
                我已阅读并同意
                <Link href="/policy/terms" className="text-brand-500">《用户服务协议》</Link>
                与
                <Link href="/policy/privacy" className="text-brand-500">《隐私政策》</Link>
              </span>
            </label>
            <button disabled={submitting} onClick={loginSms}
              className="bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded disabled:opacity-50">
              登录 / 注册
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱地址"
              className="border border-gray-200 rounded px-3 py-2.5 outline-none focus:border-brand-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（≥ 8 位，含字母数字）"
              className="border border-gray-200 rounded px-3 py-2.5 outline-none focus:border-brand-500" />
            <button disabled={submitting} onClick={loginEmail}
              className="bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded disabled:opacity-50">
              登录
            </button>
          </div>
        )}

        <div className="mt-5 text-center">
          <a href="/api/auth/oauth/wechat" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-500">
            微信扫码登录
          </a>
        </div>
      </div>
    </div>
  );
}
