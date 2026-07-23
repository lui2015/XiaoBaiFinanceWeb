'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiUrl } from '@/lib/http';
import { toast } from '@/components/Toaster';
import ArticleHtml from '@/components/ArticleHtml';

interface Cat {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  status: number;
}

export default function ManageClient({ categories: initialCats }: { categories: Cat[] }) {
  const [tab, setTab] = useState<'cats' | 'list' | 'open'>('list');
  const [cats, setCats] = useState<Cat[]>(initialCats);

  async function reloadCats() {
    const r = await apiFetch('/api/manage/categories');
    const data = await r.json();
    if (r.ok) setCats(data.data);
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${tab === 'list' ? 'bg-sunny text-ink shadow-comic-sm' : 'bg-white text-ink/70'}`}
        >内容管理</button>
        <button
          onClick={() => setTab('open')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${tab === 'open' ? 'bg-mint text-ink shadow-comic-sm' : 'bg-white text-ink/70'}`}
        >开放平台</button>
        <button
          onClick={() => setTab('cats')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${tab === 'cats' ? 'bg-sunny text-ink shadow-comic-sm' : 'bg-white text-ink/70'}`}
        >分类管理</button>
      </div>

      {tab === 'cats' && <CategoryManager cats={cats} reload={reloadCats} />}
      {tab === 'list' && <ArticleList cats={cats} onSaved={() => {/* 列表内部自行刷新 */}} />}
      {tab === 'open' && <OpenPlatform cats={cats} />}
    </div>
  );
}

/* ---------------- 分类管理 ---------------- */
function CategoryManager({ cats, reload }: { cats: Cat[]; reload: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  const tops = cats.filter(c => !c.parentId);
  const subsOf = (id: string) => cats.filter(c => c.parentId === id);

  async function add() {
    if (!name.trim()) { toast('请输入分类名称', 'error'); return; }
    setBusy(true);
    const r = await apiFetch('/api/manage/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parentId: parentId || null }),
    });
    setBusy(false);
    const data = await r.json();
    if (!r.ok) { toast(data.message || '新增失败', 'error'); return; }
    toast('已新增分类', 'success');
    setName(''); setParentId('');
    await reload();
  }

  async function rename(c: Cat) {
    const nv = window.prompt('修改分类名称', c.name);
    if (nv === null) return;
    const v = nv.trim();
    if (!v || v === c.name) return;
    const r = await apiFetch(`/api/manage/categories/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v }),
    });
    const data = await r.json();
    if (!r.ok) { toast(data.message || '修改失败', 'error'); return; }
    toast('已修改', 'success');
    await reload();
  }

  async function toggle(c: Cat) {
    const r = await apiFetch(`/api/manage/categories/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: c.status === 1 ? 0 : 1 }),
    });
    const data = await r.json();
    if (!r.ok) { toast(data.message || '操作失败', 'error'); return; }
    await reload();
  }

  async function remove(c: Cat) {
    if (!window.confirm(`确定删除分类「${c.name}」？`)) return;
    const r = await apiFetch(`/api/manage/categories/${c.id}`, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) { toast(data.message || '删除失败', 'error'); return; }
    toast('已删除', 'success');
    await reload();
  }

  return (
    <div className="space-y-5">
      {/* 新增 */}
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm">
        <div className="font-bold mb-3">新增分类</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name} onChange={e => setName(e.target.value)} maxLength={40}
            placeholder="分类名称"
            className="flex-1 border-2 border-ink rounded-full px-4 py-2 text-sm outline-none"
          />
          <select
            value={parentId} onChange={e => setParentId(e.target.value)}
            className="border-2 border-ink rounded-full px-4 py-2 text-sm bg-white"
          >
            <option value="">作为一级分类</option>
            {tops.map(t => <option key={t.id} value={t.id}>归到「{t.name}」下</option>)}
          </select>
          <button onClick={add} disabled={busy} className="comic-btn bg-mint text-ink text-sm disabled:opacity-50">添加</button>
        </div>
      </div>

      {/* 列表 */}
      <div className="space-y-3">
        {tops.map(t => (
          <div key={t.id} className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base">{t.name}</span>
              {t.status !== 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink/10 text-ink/60">已停用</span>}
              <div className="ml-auto flex gap-2 text-xs">
                <button onClick={() => rename(t)} className="px-2 py-1 rounded-full border border-ink/20 hover:bg-mint/20">改名</button>
                <button onClick={() => toggle(t)} className="px-2 py-1 rounded-full border border-ink/20 hover:bg-sunny">{t.status === 1 ? '停用' : '启用'}</button>
                <button onClick={() => remove(t)} className="px-2 py-1 rounded-full border border-coral/40 text-coral hover:bg-coral/10">删除</button>
              </div>
            </div>
            {/* 子分类 */}
            <div className="mt-3 pl-3 border-l-2 border-ink/10 space-y-2">
              {subsOf(t.id).map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="text-ink/50">└</span>
                  <span>{s.name}</span>
                  {s.status !== 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink/10 text-ink/60">已停用</span>}
                  <div className="ml-auto flex gap-2 text-xs">
                    <button onClick={() => rename(s)} className="px-2 py-1 rounded-full border border-ink/20 hover:bg-mint/20">改名</button>
                    <button onClick={() => toggle(s)} className="px-2 py-1 rounded-full border border-ink/20 hover:bg-sunny">{s.status === 1 ? '停用' : '启用'}</button>
                    <button onClick={() => remove(s)} className="px-2 py-1 rounded-full border border-coral/40 text-coral hover:bg-coral/10">删除</button>
                  </div>
                </div>
              ))}
              {subsOf(t.id).length === 0 && <div className="text-xs text-ink/40">暂无子分类</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 上传内容 ---------------- */
function ArticleUploader({ cats, onSaved }: { cats: Cat[]; onSaved?: () => void }) {
  const router = useRouter();
  const tops = cats.filter(c => !c.parentId && c.status === 1);
  const subsOf = (id: string) => cats.filter(c => c.parentId === id && c.status === 1);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [summary, setSummary] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [srcTab, setSrcTab] = useState<0 | 1>(0); // 0 HTML / 1 Markdown
  const [contentHtml, setContentHtml] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [parseInfo, setParseInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const subs = useMemo(() => (categoryId ? subsOf(categoryId) : []), [categoryId, cats]);

  async function uploadFile(file: File, kind: 'html' | 'md') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    const r = await apiFetch('/api/manage/upload', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) { toast(data.message || '解析失败', 'error'); return; }
    if (kind === 'md') { setContentMd(await file.text()); }
    setContentHtml(data.data.cleanedHtml);
    setParseInfo(`已净化：原始 ${data.data.stats.rawLen} 字 → 净化后 ${data.data.stats.cleanedLen} 字${data.data.stats.suspectStripped ? '；已移除可疑脚本' : ''}`);
  }

  async function uploadCover(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await apiFetch('/api/manage/upload/cover', { method: 'POST', body: fd });
    const data = await r.json();
    if (r.ok) { setCoverUrl(data.data.url); toast('封面已上传', 'success'); }
    else toast(data.message || '上传失败', 'error');
  }

  async function save(status: 0 | 1) {
    if (!title.trim() || title.trim().length < 2) { toast('标题至少 2 个字', 'error'); return; }
    if (!categoryId) { toast('请选择分类', 'error'); return; }
    if (srcTab === 0 && !contentHtml.trim()) { toast('请上传或粘贴 HTML 内容', 'error'); return; }
    if (srcTab === 1 && !contentMd.trim()) { toast('请上传或粘贴 Markdown 内容', 'error'); return; }
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      categoryId,
      subCategoryId: subCategoryId || undefined,
      summary: summary.trim() || undefined,
      coverUrl: coverUrl || undefined,
      status,
      sourceType: srcTab,
    };
    if (srcTab === 1) payload.contentMd = contentMd;
    else payload.contentHtml = contentHtml;
    const r = await apiFetch('/api/manage/articles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    const data = await r.json();
    if (!r.ok) { toast(data.message || '保存失败', 'error'); return; }
    toast(status === 1 ? '已发布' : '已存草稿', 'success');
    onSaved?.();
    // 重置
    setTitle(''); setSummary(''); setCoverUrl(''); setContentHtml(''); setContentMd(''); setParseInfo('');
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm">
        <input
          value={title} onChange={e => setTitle(e.target.value)} maxLength={60}
          placeholder="文章标题（2-60 字）"
          className="w-full text-lg font-bold border-b-2 border-ink/20 py-2 outline-none focus:border-ink mb-3"
        />

        <div className="flex gap-3 border-b-2 border-ink/10 mb-3">
          {[{ v: 0, label: '上传 / 粘贴 HTML' }, { v: 1, label: '上传 / 粘贴 Markdown' }].map(o => (
            <button key={o.v} onClick={() => setSrcTab(o.v as 0 | 1)}
              className={`pb-2 text-sm font-semibold ${srcTab === o.v ? 'border-b-2 border-ink text-ink' : 'text-ink/50'}`}>{o.label}</button>
          ))}
        </div>

        {srcTab === 0 ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f, 'html'); }}
            className={`transition-colors rounded-xl p-4 border-2 border-dashed ${dragOver ? 'border-sunny bg-sunny/10' : 'border-ink/20'}`}
          >
            <div className="flex items-center gap-3">
              <input type="file" accept=".html,.htm" className="text-sm" onChange={e => e.target.files && uploadFile(e.target.files[0], 'html')} />
              {dragOver && <span className="text-xs text-sunny font-semibold">松手上传</span>}
            </div>
            {!contentHtml && !dragOver && <p className="text-xs text-ink/40 mt-2">或拖拽 .html 文件到此处上传</p>}
            {parseInfo && <div className="text-xs text-ink/50 mt-2">{parseInfo}</div>}
            <textarea
              value={contentHtml} onChange={e => setContentHtml(e.target.value)} rows={16}
              className="mt-3 w-full font-mono text-xs border-2 border-ink/15 rounded-xl p-3 outline-none"
              placeholder="净化后的 HTML（可二次编辑，保存时会再次净化）"
            />
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f, 'md'); }}
            className={`transition-colors rounded-xl p-4 border-2 border-dashed ${dragOver ? 'border-sunny bg-sunny/10' : 'border-ink/20'}`}
          >
            <div className="flex items-center gap-3">
              <input type="file" accept=".md,.markdown,.txt" className="text-sm" onChange={e => e.target.files && uploadFile(e.target.files[0], 'md')} />
              {dragOver && <span className="text-xs text-sunny font-semibold">松手上传</span>}
            </div>
            {!contentMd && !dragOver && <p className="text-xs text-ink/40 mt-2">或拖拽 .md 文件到此处上传</p>}
            {parseInfo && <div className="text-xs text-ink/50 mt-2">{parseInfo}</div>}
            <textarea
              value={contentMd} onChange={e => setContentMd(e.target.value)} rows={16}
              className="mt-3 w-full font-mono text-xs border-2 border-ink/15 rounded-xl p-3 outline-none"
              placeholder="Markdown 内容"
            />
          </div>
        )}

        {contentHtml && (
          <details className="mt-4">
            <summary className="text-sm cursor-pointer font-semibold text-ink/70">预览渲染</summary>
            {srcTab === 0 ? (
              <div className="mt-3 border-2 border-ink/10 rounded-xl overflow-hidden">
                <ArticleHtml html={contentHtml} />
              </div>
            ) : (
              <div className="article-prose mt-3 border-2 border-ink/10 rounded-xl p-4" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            )}
          </details>
        )}
      </div>

      <aside className="space-y-3">
        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm space-y-3">
          <div>
            <label className="text-xs text-ink/60 block mb-1">分类</label>
            <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSubCategoryId(''); }}
              className="w-full border-2 border-ink/20 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option value="">请选择</option>
              {tops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">二级分类（可选）</label>
            <select value={subCategoryId} onChange={e => setSubCategoryId(e.target.value)} disabled={!categoryId}
              className="w-full border-2 border-ink/20 rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-50">
              <option value="">无</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">摘要（≤ 120 字，留空自动生成）</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value.slice(0, 120))} rows={3}
              className="w-full border-2 border-ink/20 rounded-lg p-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">封面图（≤ 500KB）</label>
            <input type="file" accept="image/*" className="text-xs" onChange={e => e.target.files && uploadCover(e.target.files[0])} />
            {coverUrl && <img src={apiUrl(coverUrl)} alt="" className="mt-2 max-h-24 rounded-lg border border-ink/10" />}
          </div>
        </div>

        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm space-y-2">
          <button disabled={saving} onClick={() => save(0)} className="comic-btn bg-white text-ink w-full disabled:opacity-50">保存草稿</button>
          <button disabled={saving} onClick={() => save(1)} className="comic-btn bg-sunny text-ink w-full disabled:opacity-50">发布</button>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- 内容列表 ---------------- */
interface Row {
  id: string;
  title: string;
  slug: string;
  status: number;
  viewCount: number;
  coverUrl: string | null;
  createdAt: string;
  publishAt: string | null;
  createdBy: number;
  category: { name: string } | null;
  subCategory: { name: string } | null;
}

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: '草稿', cls: 'bg-ink/10 text-ink/60' },
  1: { label: '已发布', cls: 'bg-mint text-ink' },
  2: { label: '已下架', cls: 'bg-coral/20 text-coral' },
};

function ArticleList({ cats, onSaved }: { cats: Cat[]; onSaved: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (keyword.trim()) qs.set('keyword', keyword.trim());
    if (status) qs.set('status', status);
    const r = await apiFetch(`/api/manage/articles?${qs.toString()}`);
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast(data.message || '加载失败', 'error'); return; }
    setRows(data.data.list);
    setTotal(data.data.total);
  }, [page, keyword, status]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(row: Row) {
    const next = row.status === 1 ? 0 : 1;
    setBusyId(row.id);
    const r = await apiFetch(`/api/manage/articles/${row.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
    });
    setBusyId('');
    const data = await r.json();
    if (!r.ok) { toast(data.message || '操作失败', 'error'); return; }
    toast(next === 1 ? '已发布' : '已转为草稿', 'success');
    await load();
  }

  async function remove(row: Row) {
    if (!window.confirm(`确定删除「${row.title}」？删除后将无法在前台展示。`)) return;
    setBusyId(row.id);
    const r = await apiFetch(`/api/manage/articles/${row.id}`, { method: 'DELETE' });
    setBusyId('');
    const data = await r.json();
    if (!r.ok) { toast(data.message || '删除失败', 'error'); return; }
    toast('已删除', 'success');
    if (rows.length === 1 && page > 1) setPage(p => p - 1);
    else await load();
  }

  async function exportHtml(row: Row) {
    setBusyId('export_' + row.id);
    try {
      const r = await apiFetch(`/api/manage/articles/${row.id}/export`);
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('text/html')) {
        const data = await r.json().catch(() => null);
        toast(data?.message || '导出失败', 'error');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.slug || row.id}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('已导出 HTML', 'success');
    } catch {
      toast('导出失败，请重试', 'error');
    } finally {
      setBusyId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* 操作栏：新建 + 搜索 */}
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-comic-sm flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <button
          onClick={() => setShowUpload(v => !v)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${showUpload ? 'bg-coral/20 text-coral' : 'comic-btn bg-mint text-ink'}`}
        >{showUpload ? '收起新建' : '+ 新建内容'}</button>
        <div className="flex-1 flex gap-2 w-full sm:w-auto">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }}
            placeholder="搜索标题"
            className="flex-1 min-w-[160px] border-2 border-ink rounded-full px-4 py-2 text-sm outline-none"
          />
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border-2 border-ink rounded-full px-4 py-2 text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="1">已发布</option>
            <option value="0">草稿</option>
            <option value="2">已下架</option>
          </select>
          <button onClick={() => { setPage(1); load(); }} className="comic-btn bg-mint text-ink text-sm">搜索</button>
        </div>
      </div>

      {/* 可展开的上传表单 */}
      {showUpload && (
        <div className="bg-white border-2 border-ink rounded-2xl shadow-comic-sm overflow-hidden">
          <div className="px-5 py-3 bg-sunny/20 border-b-2 border-ink/10 font-bold text-sm">新建内容</div>
          <ArticleUploader cats={cats} onSaved={() => { setShowUpload(false); load(); }} />
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white border-2 border-ink rounded-2xl shadow-comic-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream/60 text-ink/60 text-xs">
                <th className="text-left font-semibold px-4 py-3">标题</th>
                <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">分类</th>
                <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">状态</th>
                <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">阅读</th>
                <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">创建时间</th>
                <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">创建类型</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center text-ink/40 py-8">加载中…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-ink/40 py-8">暂无内容</td></tr>
              )}
              {!loading && rows.map(row => {
                const meta = STATUS_META[row.status] || STATUS_META[0];
                return (
                  <tr key={row.id} className="border-t border-ink/10 hover:bg-cream/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.title}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink/70">
                      {row.category?.name || '-'}{row.subCategory?.name ? ` / ${row.subCategory.name}` : ''}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink/70">{row.viewCount}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink/50 text-xs">{new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {row.createdBy === 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">API</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">人工</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex gap-2 text-xs">
                        <button onClick={() => router.push(`/me/manage/edit/${row.id}`)}
                          className="px-2 py-1 rounded-full border border-ink/20 hover:bg-mint/20">编辑</button>
                        <button disabled={busyId === row.id} onClick={() => toggleStatus(row)}
                          className="px-2 py-1 rounded-full border border-ink/20 hover:bg-sunny disabled:opacity-50">
                          {row.status === 1 ? '转草稿' : '发布'}
                        </button>
                        <button disabled={busyId === 'export_' + row.id} onClick={() => exportHtml(row)}
                          className="px-2 py-1 rounded-full border border-ink/20 hover:bg-sky-100 disabled:opacity-50">导出</button>
                        <button disabled={busyId === row.id} onClick={() => remove(row)}
                          className="px-2 py-1 rounded-full border border-coral/40 text-coral hover:bg-coral/10 disabled:opacity-50">删除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-full border-2 border-ink disabled:opacity-40">上一页</button>
          <span className="text-ink/60">第 {page} / {totalPages} 页 · 共 {total} 条</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-full border-2 border-ink disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

/* ======================== 开放平台 ======================== */

function copyText(text: string, label = '已复制') {
  navigator.clipboard.writeText(text).then(() => toast(label, 'success')).catch(() => toast('复制失败', 'error'));
}

interface KeyItem { raw: string; masked: string; }

function OpenPlatform({ cats }: { cats: Cat[] }) {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePrompt, setActivePrompt] = useState<'curl' | 'python' | 'ai' | 'ai_en'>('ai');
  const [stats, setStats] = useState<{ today: number; total: number } | null>(null);

  useEffect(() => { loadKeys(); loadStats(); }, []);

  async function loadStats() {
    try {
      const r = await apiFetch('/api/manage/open-stats');
      const d = await r.json();
      if (r.ok) setStats(d.data);
    } catch { /* ignore */ }
  }

  async function loadKeys() {
    setLoadingKeys(true);
    try {
      const r = await apiFetch('/api/manage/api-keys');
      const d = await r.json();
      if (r.ok) setKeys(d.data.keys || []);
    } catch { /* ignore */ }
    setLoadingKeys(false);
  }

  async function generateKey() {
    setGenerating(true);
    try {
      const r = await apiFetch('/api/manage/api-keys', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        toast('新 Key 已生成（请立即复制保存）', 'success');
        loadKeys();
        if (d.data?.key) copyText(d.data.key, '新 API Key 已复制');
      } else {
        toast(d.message || '生成失败', 'error');
      }
    } catch { toast('生成失败', 'error'); }
    setGenerating(false);
  }

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/XiaoBaiFinance` : '';
  const endpoint = `${baseUrl}/api/open/articles`;
  const demoKey = keys[0]?.raw || '<YOUR_API_KEY>';

  /* ---- 提示词模板 ---- */
  const prompts = {
    ai: `你是一个内容发布助手。请将以下文章通过小白理财开放接口自动发布。

## 接口信息
- 接口地址：${endpoint}
- 认证方式：Header Authorization: Bearer ${demoKey}
- 方法：POST
- Content-Type: application/json

## 请求体字段说明
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 标题（2-60字） |
| summary | string | 否 | 摘要（≤120字） |
| categoryId | string | 是 | 分类 ID |
| subCategoryId | string | 否 | 子分类 ID |
| coverUrl | string | 否 | 封面图 URL |
| status | number | 否 | 0=草稿 1=发布（默认1） |
| sourceType | number | 否 | 0=HTML 1=Markdown（默认0） |
| contentHtml | string | 否* | HTML 正文（sourceType=0时必填） |
| contentMd | string | 否* | Markdown 正文（sourceType=1时必填） |

## 可用分类
${cats.map(c => `- ${c.name} (ID: ${c.id})`).join('\\n')}

## 你的任务
当我给你一篇文章时，请你：
1. 自动提取标题、摘要、正文 HTML
2. 判断最匹配的分类 ID
3. 构造完整的 JSON 请求体
4. 输出可直接用 curl / Python 发送的完整请求代码

请回复"准备就绪，请发送文章"。`,

    ai_en: `You are a content publishing assistant. Publish articles via Xiaobai Finance Open API.

## Endpoint
URL: ${endpoint}
Auth: Header \`Authorization: Bearer ${demoKey}\`
Method: POST
Content-Type: application/json

## Request Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Title (2-60 chars) |
| summary | string | no | Summary (≤120 chars) |
| categoryId | string | yes | Category ID |
| subCategoryId | string | no | Sub-category ID |
| coverUrl | string | no | Cover image URL |
| status | number | no | 0=draft 1=published (default 1) |
| sourceType | number | no | 0=HTML 1=Markdown (default 0) |
| contentHtml | string | conditional | HTML body (required when sourceType=0) |
| contentMd | string | conditional | Markdown body (required when sourceType=1) |

## Available Categories
${cats.map(c => `- ${c.name} (ID: ${c.id})`).join('\\n')}

## Your Task
When I provide an article:
1. Extract title, summary, and body HTML
2. Match the best category ID
3. Build the complete JSON payload
4. Output ready-to-use curl / Python request code

Reply "Ready, please send the article."`,

    curl: `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${demoKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "文章标题",
    "summary": "文章摘要",
    "categoryId": "${cats[0]?.id || '1'}",
    "status": 1,
    "sourceType": 0,
    "contentHtml": "<p>文章正文 HTML 内容</p>"
  }'`,

    python: `import requests

url = "${endpoint}"
headers = {
    "Authorization": "Bearer ${demoKey}",
    "Content-Type": "application/json"
}
payload = {
    "title": "文章标题",
    "summary": "文章摘要",
    "categoryId": "${cats[0]?.id || '1'}",
    "status": 1,
    "sourceType": 0,
    "contentHtml": "<p>文章正文 HTML 内容</p>"
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.json())`,
  };

  return (
    <div className="space-y-4">
      {/* 调用统计 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-sunny/15 border-2 border-ink rounded-2xl p-4 text-center">
          <div className="text-3xl font-extrabold text-ink">{stats ? stats.today : '—'}</div>
          <div className="text-xs text-ink/60 mt-1">当日调用次数</div>
        </div>
        <div className="bg-mint/15 border-2 border-ink rounded-2xl p-4 text-center">
          <div className="text-3xl font-extrabold text-ink">{stats ? stats.total : '—'}</div>
          <div className="text-xs text-ink/60 mt-1">累计调用次数</div>
        </div>
      </div>

      {/* API Key 管理 */}
      <div className="bg-white border-2 border-ink rounded-2xl p-5 shadow-comic-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">API Key 管理</h3>
          <button onClick={generateKey} disabled={generating}
            className="comic-btn bg-mint text-ink text-sm px-3 py-1.5 disabled:opacity-50">
            {generating ? '生成中...' : '+ 生成新 Key'}
          </button>
        </div>
        <p className="text-xs text-ink/50 mb-3">Key 用于调用开放接口鉴权，请妥善保管。生成后仅显示一次完整值。</p>
        {loadingKeys ? (
          <div className="text-sm text-ink/40 py-4 text-center">加载中…</div>
        ) : keys.length === 0 ? (
          <div className="text-sm text-ink/40 py-4 text-center">暂无 Key，点击上方按钮生成</div>
        ) : (
          <div className="space-y-2">
            {keys.map((k, i) => (
              <div key={i} className="flex items-center gap-2 bg-cream/40 rounded-xl px-4 py-2.5">
                <code className="flex-1 text-sm font-mono truncate">{k.masked}</code>
                <button onClick={() => copyText(k.raw, 'Key 已复制')}
                  className="text-xs px-2.5 py-1 rounded-full border border-ink/20 hover:bg-mint/20 shrink-0">复制</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 接口信息 */}
      <div className="bg-white border-2 border-ink rounded-2xl p-5 shadow-comic-sm">
        <h3 className="font-bold text-base mb-3">接口信息</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2"><span className="shrink-0 text-ink/50 w-20">地址</span><code className="bg-cream px-2 py-0.5 rounded text-xs break-all">{endpoint}</code></div>
          <div className="flex gap-2"><span className="shrink-0 text-ink/50 w-20">方法</span><code className="bg-sunny/30 px-2 py-0.5 rounded font-bold">POST</code></div>
          <div className="flex gap-2"><span className="shrink-0 text-ink/50 w-20">认证</span><code>Authorization: Bearer &lt;API_KEY&gt;</code></div>
          <div className="flex gap-2 items-start"><span className="shrink-0 text-ink/50 w-20 pt-0.5">测试</span>
            <button onClick={() => copyText(prompts.curl, 'cURL 已复制')} className="text-xs px-2.5 py-1 rounded-full border border-ink/20 hover:bg-sky-100">复制 cURL 示例</button>
          </div>
        </div>
      </div>

      {/* AI 提示词 */}
      <div className="bg-white border-2 border-ink rounded-2xl shadow-comic-sm overflow-hidden">
        <div className="px-5 py-3 bg-mint/15 border-b-2 border-ink/10 flex items-center justify-between">
          <h3 className="font-bold text-base">AI 调用提示词</h3>
          <span className="text-[11px] text-ink/40">一键复制给 ChatGPT / Claude / DeepSeek 等 AI 使用</span>
        </div>

        {/* Prompt tab 切换 */}
        <div className="px-5 pt-3 flex gap-2 flex-wrap">
          {[
            { v: 'ai' as const, label: '中文提示词' },
            { v: 'ai_en' as const, label: '英文提示词' },
            { v: 'curl' as const, label: 'cURL 示例' },
            { v: 'python' as const, label: 'Python 示例' },
          ].map(p => (
            <button key={p.v} onClick={() => setActivePrompt(p.v)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                activePrompt === p.v ? 'bg-mint text-ink border-ink' : 'border-ink/20 text-ink/60 hover:bg-cream'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {/* Prompt 内容 + 复制 */}
        <div className="p-5">
          <pre className="bg-[#0f172a] text-emerald-300 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words">{prompts[activePrompt]}</pre>
          <div className="mt-3 flex justify-end">
            <button onClick={() => copyText(prompts[activePrompt], '已复制到剪贴板')}
              className="comic-btn bg-mint text-ink text-sm px-4 py-1.5 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              一键复制
            </button>
          </div>
        </div>
      </div>

      {/* 使用流程说明 */}
      <div className="bg-white border-2 border-ink rounded-2xl p-5 shadow-comic-sm text-sm text-ink/70 space-y-2">
        <h3 className="font-bold text-base text-ink mb-2">使用流程</h3>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>在上方生成或查看你的 <strong className="text-ink">API Key</strong></li>
          <li>选择下方的 <strong className="text-ink">AI 提示词</strong>，一键复制</li>
          <li>打开 ChatGPT / Claude / DeepSeek 等任意 AI 对话窗口，粘贴提示词</li>
          <li>AI 回复「准备就绪」后，发送你要发布的文章内容</li>
          <li>AI 会自动构造请求并输出可执行的代码，你也可以让 AI 直接帮你调用接口</li>
        </ol>
      </div>
    </div>
  );
}
