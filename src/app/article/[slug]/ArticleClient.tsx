'use client';
import { useEffect, useState } from 'react';
import { Heart, Bookmark, MessageSquare, ArrowUp } from 'lucide-react';
import { requireLogin } from '@/components/LoginPromptModal';
import { toast } from '@/components/Toaster';

export default function ArticleClient({
  articleId, initialLiked, initialFavorited, isLogin, children,
}: {
  articleId: string;
  initialLiked: boolean;
  initialFavorited: boolean;
  isLogin: boolean;
  children: React.ReactNode;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [showFeedback, setShowFeedback] = useState(false);

  // 阅读量上报
  useEffect(() => {
    fetch(`/api/articles/${articleId}/view`, { method: 'POST' }).catch(() => {});
    // 写入本地浏览历史（≤50）
    try {
      const k = 'xb_history';
      const arr = JSON.parse(localStorage.getItem(k) || '[]') as { id: string; at: number }[];
      const filtered = arr.filter(x => x.id !== articleId);
      filtered.unshift({ id: articleId, at: Date.now() });
      localStorage.setItem(k, JSON.stringify(filtered.slice(0, 50)));
    } catch { /* ignore */ }
  }, [articleId]);

  async function toggleLike() {
    if (!isLogin) return requireLogin();
    const method = liked ? 'DELETE' : 'POST';
    const r = await fetch(`/api/u/articles/${articleId}/like`, { method });
    if (r.ok) { setLiked(!liked); toast(liked ? '已取消点赞' : '已点赞', 'success'); }
    else toast('操作失败', 'error');
  }
  async function toggleFav() {
    if (!isLogin) return requireLogin();
    const method = favorited ? 'DELETE' : 'POST';
    const r = await fetch(`/api/u/articles/${articleId}/favorite`, { method });
    if (r.ok) { setFavorited(!favorited); toast(favorited ? '已取消收藏' : '已收藏', 'success'); }
    else toast('操作失败', 'error');
  }

  return (
    <>
      {children}
      {/* 操作区 */}
      <div className="flex justify-center gap-3 my-6">
        <button onClick={toggleLike} className={`flex items-center gap-1 px-4 py-2 rounded-full border ${liked ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-gray-200 hover:border-rose-200'}`}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> 点赞
        </button>
        <button onClick={toggleFav} className={`flex items-center gap-1 px-4 py-2 rounded-full border ${favorited ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-gray-200 hover:border-amber-200'}`}>
          <Bookmark size={16} fill={favorited ? 'currentColor' : 'none'} /> 收藏
        </button>
        <button onClick={() => isLogin ? setShowFeedback(true) : requireLogin()}
          className="flex items-center gap-1 px-4 py-2 rounded-full border bg-white border-gray-200 hover:border-brand-200">
          <MessageSquare size={16} /> 反馈
        </button>
      </div>

      {showFeedback && <FeedbackModal articleId={articleId} onClose={() => setShowFeedback(false)} />}

      {/* 返回顶部 */}
      <BackToTop />
    </>
  );
}

function FeedbackModal({ articleId, onClose }: { articleId: string; onClose: () => void }) {
  const [type, setType] = useState<0 | 1 | 2>(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (type === 2 && !content.trim()) return toast('请填写报错描述', 'error');
    setLoading(true);
    const r = await fetch(`/api/u/articles/${articleId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content: content.trim() || undefined }),
    });
    setLoading(false);
    if (r.ok) { toast('感谢你的反馈', 'success'); onClose(); }
    else toast('提交失败，请稍后再试', 'error');
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:w-[400px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">内容反馈</h3>
        <div className="flex gap-2 mb-3">
          {[
            { v: 0, label: '有用 👍' },
            { v: 1, label: '没用 👎' },
            { v: 2, label: '内容有错 🐛' },
          ].map((o) => (
            <button key={o.v} onClick={() => setType(o.v as 0 | 1 | 2)}
              className={`px-3 py-1.5 rounded text-sm border ${type === o.v ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-gray-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          rows={3} maxLength={200}
          placeholder="可补充描述（≤ 200 字）"
          className="w-full border border-gray-200 rounded p-2 text-sm" />
        <div className="flex gap-2 mt-3">
          <button className="flex-1 py-2 border border-gray-200 rounded text-sm" onClick={onClose}>取消</button>
          <button className="flex-1 py-2 bg-brand-500 text-white rounded text-sm disabled:opacity-50" disabled={loading} onClick={submit}>
            {loading ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      aria-label="回到顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-4 bottom-20 sm:bottom-8 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand-500">
      <ArrowUp size={18} />
    </button>
  );
}
