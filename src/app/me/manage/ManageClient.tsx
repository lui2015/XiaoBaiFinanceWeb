'use client';
import { useMemo, useState } from 'react';
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
  const [tab, setTab] = useState<'cats' | 'upload'>('cats');
  const [cats, setCats] = useState<Cat[]>(initialCats);

  async function reloadCats() {
    const r = await apiFetch('/api/manage/categories');
    const data = await r.json();
    if (r.ok) setCats(data.data);
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('cats')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${tab === 'cats' ? 'bg-sunny text-ink shadow-comic-sm' : 'bg-white text-ink/70'}`}
        >分类管理</button>
        <button
          onClick={() => setTab('upload')}
          className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-ink transition-colors ${tab === 'upload' ? 'bg-sunny text-ink shadow-comic-sm' : 'bg-white text-ink/70'}`}
        >上传内容</button>
      </div>

      {tab === 'cats'
        ? <CategoryManager cats={cats} reload={reloadCats} />
        : <ArticleUploader cats={cats} />}
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
function ArticleUploader({ cats }: { cats: Cat[] }) {
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
