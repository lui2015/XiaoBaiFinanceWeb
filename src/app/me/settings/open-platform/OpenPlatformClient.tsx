'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/http';
import { toast } from '@/components/Toaster';

interface KeyItem {
  id: string;
  keyPrefix: string;
  name: string | null;
  status: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface NewKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  token: string;
  createdAt: string;
}

const CATEGORIES = [
  ['basics', '基础概念'],
  ['fundamental', '基本面分析'],
  ['technical', '技术面分析'],
  ['macro', '宏观经济'],
  ['instruments', '投资品种'],
  ['planning', '理财规划'],
  ['behavioral', '行为金融'],
];

function buildPrompt(base: string, key: string, nickname: string): string {
  const endpoint = `${base}/api/open/articles`;
  const k = key || '<你的开放平台密钥>';
  const catLines = CATEGORIES.map(([s, n]) => `    ${s} = ${n}`).join('\n');
  return `你是「小白财经」的内容投稿助手。请用下面的开放接口，把用户（${nickname}）提供的财经内容发布到平台上。

接口地址：POST ${endpoint}
认证方式：在请求头中携带  Authorization: Bearer ${k}
Content-Type: application/json

请求体字段（JSON）：
- title：文章标题（2~60 字，必填）
- contentHtml：HTML 正文；或 sourceType=1 时改用 contentMd 写 Markdown（二选一必填）
- sourceType：0 表示 HTML（默认），1 表示 Markdown
- categorySlug：一级分类（必填其一），可选值：
${catLines}
- subCategoryId：二级分类 ID（可选，例如 21 表示「快讯」）
- summary：摘要（可选，不填则自动截取正文前 120 字）
- coverUrl：封面图 URL（可选）
- tags：标签数组，最多 5 个（可选）

规则：
1. 内容需经过安全检查，不要包含 <script>、内联事件等危险内容；
2. 分类必须使用上面列出的 categorySlug，否则会报错；
3. 每次只发布一篇；调用成功返回 {"code":0} 表示已发布；
4. 使用上面提供的密钥调用，调用次数会计入该用户的开放平台统计。

我的密钥：${k}`;
}

export default function OpenPlatformClient({ user }: { user: { id: string; nickname: string } }) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}/XiaoBaiFinance` : '';

  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [today, setToday] = useState(0);
  const [total, setTotal] = useState(0);

  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<NewKey | null>(null);
  const [promptKey, setPromptKey] = useState('');

  const prompt = useMemo(() => buildPrompt(base, promptKey, user.nickname), [base, promptKey, user.nickname]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/u/open-platform');
      const data = await r.json();
      if (!r.ok || data.code !== 0) throw new Error(data.message || '加载失败');
      setKeys(data.data.keys ?? []);
      setToday(data.data.today ?? 0);
      setTotal(data.data.total ?? 0);
    } catch (e: any) {
      toast(e?.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyText = useCallback(async (text: string, okMsg = '已复制到剪贴板') => {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg, 'success');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast(okMsg, 'success');
      } catch {
        toast('复制失败，请手动复制', 'error');
      }
      document.body.removeChild(ta);
    }
  }, []);

  const createKey = useCallback(async () => {
    setCreating(true);
    try {
      const r = await apiFetch('/api/u/open-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok || data.code !== 0) throw new Error(data.message || '创建失败');
      setJustCreated(data.data);
      setPromptKey(data.data.token); // 自动填入提示词，方便一键复制
      setNameInput('');
      await load();
    } catch (e: any) {
      toast(e?.message || '创建失败', 'error');
    } finally {
      setCreating(false);
    }
  }, [nameInput, load]);

  const revoke = useCallback(
    async (id: string) => {
      if (!confirm('确定吊销该密钥？吊销后使用该密钥的 AI 将无法继续上传内容。')) return;
      try {
        const r = await apiFetch(`/api/u/open-platform/keys/${id}`, { method: 'DELETE' });
        const data = await r.json();
        if (!r.ok || data.code !== 0) throw new Error(data.message || '操作失败');
        toast('已吊销', 'success');
        await load();
      } catch (e: any) {
        toast(e?.message || '操作失败', 'error');
      }
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">开放平台</h1>
          <p className="text-sm text-gray-500 mt-1">
            生成 API 密钥，让 AI 直接把内容投稿到「小白财经」；可复制专属提示词交给你的 AI 使用。
          </p>
        </div>
        <Link href="/XiaoBaiFinance/me/settings" className="text-sm text-indigo-600 hover:underline">
          ← 返回设置
        </Link>
      </div>

      {/* 调用统计 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-sm text-gray-500">今日 AI 调用次数</div>
          <div className="text-3xl font-bold text-indigo-600 mt-1">{loading ? '—' : today}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-sm text-gray-500">累积 AI 调用次数</div>
          <div className="text-3xl font-bold text-indigo-600 mt-1">{loading ? '—' : total}</div>
        </div>
      </div>

      {/* AI 提示词 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">AI 提示词（一键复制给 AI）</h2>
          <button
            onClick={() => copyText(prompt)}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            复制提示词
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          把下面这段提示词发给你的 AI（如 ChatGPT / 通义 / 文心 等），它即可按规范调用开放接口投稿。
          提示词中的密钥可手动修改，或使用下方「我的密钥」创建后自动填入。
        </p>
        <input
          value={promptKey}
          onChange={(e) => setPromptKey(e.target.value)}
          placeholder="在此粘贴你的开放平台密钥（创建密钥后可自动填入）"
          className="w-full mb-3 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <textarea
          readOnly
          value={prompt}
          rows={18}
          className="w-full px-3 py-2 border border-gray-200 rounded bg-gray-50 text-xs font-mono text-gray-700 resize-y"
        />
      </section>

      {/* 我的密钥 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">我的密钥</h2>
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">备注名（可选）</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="例如：我的写作助手"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={createKey}
            disabled={creating}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? '创建中…' : '创建新密钥'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">加载中…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-400">还没有密钥，点击「创建新密钥」开始使用开放平台。</p>
        ) : (
          <div className="overflow-hidden border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">密钥</th>
                  <th className="text-left px-3 py-2 font-medium">备注</th>
                  <th className="text-left px-3 py-2 font-medium">状态</th>
                  <th className="text-left px-3 py-2 font-medium">最近使用</th>
                  <th className="text-right px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{k.keyPrefix}…</td>
                    <td className="px-3 py-2 text-gray-700">{k.name || '—'}</td>
                    <td className="px-3 py-2">
                      {k.status === 1 ? (
                        <span className="text-emerald-600 text-xs">启用</span>
                      ) : (
                        <span className="text-gray-400 text-xs">停用</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('zh-CN') : '从未'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => revoke(k.id)}
                        className="text-rose-600 text-xs hover:underline"
                      >
                        吊销
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 新密钥弹窗（明文仅展示一次） */}
      {justCreated && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setJustCreated(null)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">密钥已创建</h3>
            <p className="text-sm text-gray-600 mb-3">
              请立即复制保存，关闭此窗口后将无法再次查看明文密钥。
            </p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={justCreated.token}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-xs font-mono bg-gray-50"
              />
              <button
                onClick={() => copyText(justCreated.token, '密钥已复制')}
                className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                复制
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  copyText(buildPrompt(base, justCreated.token, user.nickname), '提示词（含密钥）已复制');
                }}
                className="px-3 py-2 rounded border border-indigo-600 text-indigo-600 text-sm hover:bg-indigo-50"
              >
                复制提示词（含此密钥）
              </button>
              <button
                onClick={() => setJustCreated(null)}
                className="px-3 py-2 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
