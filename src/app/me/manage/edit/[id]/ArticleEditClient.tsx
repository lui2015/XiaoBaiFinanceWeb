'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiUrl } from '@/lib/http';
import { toast } from '@/components/Toaster';

interface Cat {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  status: number;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  coverUrl: string | null;
  status: number;
  sourceType: number;
  contentHtml: string | null;
  contentMd: string | null;
}

export default function ArticleEditClient({ categories: cats, article }: { categories: Cat[]; article: Article }) {
  const router = useRouter();
  const tops = cats.filter(c => !c.parentId && c.status === 1);
  const subsOf = (id: string) => cats.filter(c => c.parentId === id && c.status === 1);

  const [title, setTitle] = useState(article.title || '');
  const [categoryId, setCategoryId] = useState(article.categoryId || '');
  const [subCategoryId, setSubCategoryId] = useState(article.subCategoryId || '');
  const [summary, setSummary] = useState(article.summary || '');
  const [coverUrl, setCoverUrl] = useState(article.coverUrl || '');
  const [srcTab, setSrcTab] = useState<0 | 1>(article.sourceType === 1 ? 1 : 0); // 0 HTML / 1 Markdown
  const [contentHtml, setContentHtml] = useState(article.contentHtml || '');
  const [contentMd, setContentMd] = useState(article.contentMd || '');
  const [parseInfo, setParseInfo] = useState('');
  const [saving, setSaving] = useState(false);

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
      subCategoryId: subCategoryId || null,
      summary: summary.trim() || undefined,
      coverUrl: coverUrl || null,
      status,
      sourceType: srcTab,
    };
    if (srcTab === 1) payload.contentMd = contentMd;
    else payload.contentHtml = contentHtml;
    const r = await apiFetch(`/api/manage/articles/${article.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    const data = await r.json();
    if (!r.ok) { toast(data.message || '保存失败', 'error'); return; }
    toast(status === 1 ? '已发布' : '已存草稿', 'success');
    const slug = data.data?.slug || article.slug;
    router.push(`/article/${slug}`);
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
          <div>
            <input type="file" accept=".html,.htm" className="text-sm" onChange={e => e.target.files && uploadFile(e.target.files[0], 'html')} />
            {parseInfo && <div className="text-xs text-ink/50 mt-2">{parseInfo}</div>}
            <textarea
              value={contentHtml} onChange={e => setContentHtml(e.target.value)} rows={16}
              className="mt-3 w-full font-mono text-xs border-2 border-ink/15 rounded-xl p-3 outline-none"
              placeholder="净化后的 HTML（可二次编辑，保存时会再次净化）"
            />
          </div>
        ) : (
          <div>
            <input type="file" accept=".md,.markdown,.txt" className="text-sm" onChange={e => e.target.files && uploadFile(e.target.files[0], 'md')} />
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
            <div className="article-prose mt-3 border-2 border-ink/10 rounded-xl p-4" dangerouslySetInnerHTML={{ __html: contentHtml }} />
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
          <button disabled={saving} onClick={() => save(1)} className="comic-btn bg-sunny text-ink w-full disabled:opacity-50">保存并发布</button>
        </div>
      </aside>
    </div>
  );
}
