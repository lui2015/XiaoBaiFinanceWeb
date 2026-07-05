'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http';

function FileDrop({ accept, exts, hint, onFile }: {
  accept: string; exts: string[]; hint: string; onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [name, setName] = useState('');
  const [tip, setTip] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(f?: File | null) {
    if (!f) return;
    const ok = exts.some((e) => f.name.toLowerCase().endsWith(e));
    if (!ok) { setTip(`仅支持 ${exts.join(' / ')} 文件`); return; }
    setTip(''); setName(f.name); onFile(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${drag ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 bg-gray-50'}`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="text-sm text-gray-600">
        {name
          ? <span className="text-brand-600 font-medium break-all">{name}</span>
          : <>将文件拖到此处，或<span className="text-brand-500">点击选择</span></>}
      </div>
      <div className="text-[11px] text-gray-400 mt-1">{tip || hint}</div>
    </div>
  );
}

interface Cat { id: string; name: string; children?: Cat[] }
interface Initial {
  id?: string;
  title: string; slug: string; summary: string;
  sourceType: 0 | 1 | 2;
  contentHtml: string; contentMd: string;
  categoryId: string; subCategoryId: string;
  coverUrl: string; isRecommend: boolean;
  status: 0 | 1 | 2; scheduledAt: string;
}

const EMPTY: Initial = {
  title: '', slug: '', summary: '',
  sourceType: 2, contentHtml: '', contentMd: '',
  categoryId: '', subCategoryId: '',
  coverUrl: '', isRecommend: false,
  status: 0, scheduledAt: '',
};

export default function ArticleEditor({
  mode, categories, initial,
}: { mode: 'create' | 'edit'; categories: Cat[]; initial?: Initial }) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial || EMPTY);
  const [tab, setTab] = useState<0 | 1 | 2>(initial?.sourceType ?? 2);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [parseInfo, setParseInfo] = useState<string>('');

  function update<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV(s => ({ ...s, [k]: val }));
  }

  async function uploadFile(file: File, kind: 'html' | 'md') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    const r = await apiFetch('/api/admin/articles/parse', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) return setErr(data.message || '解析失败');
    setErr('');
    if (kind === 'html') update('contentHtml', data.data.cleanedHtml);
    else { update('contentMd', file ? await file.text() : ''); update('contentHtml', data.data.cleanedHtml); }
    setParseInfo(`已净化：原始 ${data.data.stats.rawLen} 字 → 净化后 ${data.data.stats.cleanedLen} 字${data.data.stats.suspectStripped ? '；移除了可疑脚本' : ''}`);
  }

  async function uploadCover(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await apiFetch('/api/admin/upload/cover', { method: 'POST', body: fd });
    const data = await r.json();
    if (r.ok) update('coverUrl', data.data.url);
    else setErr(data.message || '上传失败');
  }

  async function save(targetStatus: 0 | 1 | 2) {
    if (!v.title || !v.categoryId) { setErr('请填写标题与分类'); return; }
    setSaving(true); setErr('');
    const payload: any = {
      title: v.title,
      slug: v.slug || undefined,
      summary: v.summary || undefined,
      categoryId: v.categoryId,
      subCategoryId: v.subCategoryId || undefined,
      coverUrl: v.coverUrl || undefined,
      isRecommend: v.isRecommend,
      status: targetStatus,
      sourceType: tab,
      scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : undefined,
    };
    if (tab === 1) payload.contentMd = v.contentMd;
    else payload.contentHtml = v.contentHtml;

    const url = mode === 'create' ? '/api/admin/articles' : `/api/admin/articles/${v.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const r = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    const data = await r.json();
    if (!r.ok) return setErr(data.message || '保存失败');
    router.push('/admin/articles');
  }

  const subs = categories.find(c => c.id === v.categoryId)?.children || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="bg-white rounded border border-gray-100 p-4">
        <h2 className="font-semibold mb-3">{mode === 'create' ? '新建文章' : '编辑文章'}</h2>
        <input value={v.title} onChange={(e) => update('title', e.target.value)} maxLength={60} placeholder="标题（≤ 60 字）"
          className="w-full text-lg font-medium border-b border-gray-200 py-2 outline-none focus:border-brand-500 mb-2" />
        <input value={v.slug} onChange={(e) => update('slug', e.target.value)} placeholder="URL slug（留空自动生成）"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-3" />

        <div className="flex gap-3 border-b border-gray-100 mb-3">
          {[
            { v: 0, label: '上传 HTML' },
            { v: 1, label: '上传 Markdown' },
            { v: 2, label: '在线编辑' },
          ].map((o) => (
            <button key={o.v} onClick={() => setTab(o.v as 0 | 1 | 2)}
              className={`pb-2 text-sm ${tab === o.v ? 'border-b-2 border-brand-500 text-brand-500' : 'text-gray-500'}`}>{o.label}</button>
          ))}
        </div>

        {tab === 0 && (
          <div>
            <FileDrop accept=".html,.htm" exts={['.html', '.htm']} hint="支持 .html / .htm 文件，上传后自动净化"
              onFile={(f) => uploadFile(f, 'html')} />
            {parseInfo && <div className="text-xs text-gray-500 mt-2">{parseInfo}</div>}
            <textarea
              value={v.contentHtml} onChange={(e) => update('contentHtml', e.target.value)}
              rows={16} className="mt-3 w-full font-mono text-xs border border-gray-200 rounded p-3"
              placeholder="净化后的 HTML（可二次编辑）" />
          </div>
        )}
        {tab === 1 && (
          <div>
            <FileDrop accept=".md,.markdown,.txt" exts={['.md', '.markdown', '.txt']} hint="支持 .md / .markdown / .txt 文件"
              onFile={(f) => uploadFile(f, 'md')} />
            {parseInfo && <div className="text-xs text-gray-500 mt-2">{parseInfo}</div>}
            <textarea
              value={v.contentMd} onChange={(e) => update('contentMd', e.target.value)}
              rows={16} className="mt-3 w-full font-mono text-xs border border-gray-200 rounded p-3"
              placeholder="Markdown 内容" />
          </div>
        )}
        {tab === 2 && (
          <textarea
            value={v.contentHtml} onChange={(e) => update('contentHtml', e.target.value)}
            rows={20} className="w-full font-mono text-xs border border-gray-200 rounded p-3"
            placeholder="直接编辑 HTML（保存时会自动净化）" />
        )}

        {/* 预览 */}
        {v.contentHtml && (
          <details className="mt-4">
            <summary className="text-sm cursor-pointer text-brand-500">预览渲染</summary>
            <div className="article-prose mt-3 border border-gray-100 rounded p-4" dangerouslySetInnerHTML={{ __html: v.contentHtml }} />
          </details>
        )}
      </div>

      <aside className="space-y-3">
        <div className="bg-white rounded border border-gray-100 p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">分类</label>
            <select value={v.categoryId} onChange={(e) => { update('categoryId', e.target.value); update('subCategoryId', ''); }}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
              <option value="">请选择</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">二级分类（可选）</label>
            <select value={v.subCategoryId} onChange={(e) => update('subCategoryId', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" disabled={!v.categoryId}>
              <option value="">无</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">摘要（≤ 120 字）</label>
            <textarea value={v.summary} onChange={(e) => update('summary', e.target.value.slice(0, 120))}
              rows={3} className="w-full border border-gray-200 rounded p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">封面图</label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files && uploadCover(e.target.files[0])} className="text-xs" />
            {v.coverUrl && <img src={v.coverUrl} alt="" className="mt-2 max-h-24 rounded" />}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.isRecommend} onChange={(e) => update('isRecommend', e.target.checked)} />
            <span>推荐到首页</span>
          </label>
          <div>
            <label className="text-xs text-gray-500 block mb-1">定时发布（可选）</label>
            <input type="datetime-local" value={v.scheduledAt} onChange={(e) => update('scheduledAt', e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm" />
            <div className="text-[11px] text-gray-400 mt-1">设置后到点自动发布；状态先保持「草稿」</div>
          </div>
        </div>

        {err && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded p-3">{err}</div>}

        <div className="bg-white rounded border border-gray-100 p-4 space-y-2">
          <button disabled={saving} onClick={() => save(0)} className="w-full bg-gray-100 hover:bg-gray-200 py-2 rounded text-sm disabled:opacity-50">保存草稿</button>
          <button disabled={saving} onClick={() => save(1)} className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded text-sm disabled:opacity-50">{v.scheduledAt ? '保存并定时发布' : '发布'}</button>
        </div>
      </aside>
    </div>
  );
}
