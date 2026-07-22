import { useEffect, useState } from 'react';
import Header from '../components/Header';
import PostFormModal from '../components/PostFormModal';
import PostDetailModal from '../components/PostDetailModal';
import GuildBadge from '../components/GuildBadge';
import { BOARD_TABS, fetchPosts, subscribePinnedNotices } from '../lib/board';

function fmt(ts) {
  if (!ts || !ts.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function PostRow({ post, onOpen, pinned }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      className="w-full text-left rounded-xl border border-base-700 bg-base-850 hover:border-base-500 transition p-3 flex items-center gap-3"
    >
      {pinned && <span className="text-amber-400 shrink-0" title="고정 공지">📌</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-base-100 truncate">{post.title}</span>
          {(post.commentCount || 0) > 0 && (
            <span className="text-xs text-indigo-300 font-bold shrink-0">[{post.commentCount}]</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-base-500">
          {post.authorIsMaster && <span>👑</span>}
          <span className="text-base-400">{post.authorNickname}</span>
          <GuildBadge guildId={post.authorGuildId} size="xs" />
        </div>
      </div>
      <span className="text-[11px] text-base-500 shrink-0">{fmt(post.createdAt)}</span>
    </button>
  );
}

export default function BoardPage() {
  const [tab, setTab] = useState('all');
  const [posts, setPosts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinnedNotices, setPinnedNotices] = useState([]);
  const [form, setForm] = useState({ open: false, editing: null });
  const [detailId, setDetailId] = useState(null);

  // 상단 고정 공지 (실시간)
  useEffect(() => subscribePinnedNotices(setPinnedNotices), []);

  const loadFirst = async (cat) => {
    setLoading(true);
    try {
      const r = await fetchPosts(cat);
      setPosts(r.posts);
      setLastDoc(r.lastDoc);
      setHasMore(r.hasMore);
    } catch {
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFirst(tab); }, [tab]);

  const loadMore = async () => {
    const r = await fetchPosts(tab, lastDoc);
    setPosts((prev) => [...prev, ...r.posts]);
    setLastDoc(r.lastDoc);
    setHasMore(r.hasMore);
  };

  const onFormClose = (saved) => {
    setForm({ open: false, editing: null });
    if (saved) loadFirst(tab);
  };
  const onDetailClose = (changed) => {
    setDetailId(null);
    if (changed) loadFirst(tab);
  };

  // 고정 공지는 상단 스트립에 상시 노출 → 아래 목록에서는 항상 중복 제거.
  const pinnedIds = new Set(pinnedNotices.map((p) => p.id));
  const listPosts = posts.filter((p) => !pinnedIds.has(p.id));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black text-base-100">게시판</h1>
          <button type="button" onClick={() => setForm({ open: true, editing: null })} className="btn-primary px-4 py-2 text-sm">✏️ 글쓰기</button>
        </div>

        {/* 상단 고정 공지 — 모든 탭에서 상시 노출 */}
        {pinnedNotices.length > 0 && (
          <div className="mb-4 space-y-2">
            {pinnedNotices.map((p) => (
              <PostRow key={p.id} post={p} onOpen={setDetailId} pinned />
            ))}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2 mb-4 border-b border-base-800 pb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTab(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                tab === c.id ? 'bg-base-100 text-base-900' : 'text-base-400 hover:text-base-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="py-16 text-center text-base-500 text-sm">불러오는 중…</div>
        ) : listPosts.length === 0 ? (
          <div className="py-16 text-center text-base-500 text-sm">아직 게시글이 없어요.</div>
        ) : (
          <div className="space-y-2">
            {listPosts.map((p) => (
              <PostRow key={p.id} post={p} onOpen={setDetailId} pinned={p.pinned} />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center mt-4">
            <button type="button" onClick={loadMore} className="px-5 py-2 rounded-full bg-base-800 border border-base-700 hover:border-base-500 text-sm font-semibold text-base-200 transition">더 보기</button>
          </div>
        )}
      </main>

      <PostFormModal open={form.open} editing={form.editing} defaultCategory={tab} onClose={onFormClose} />
      <PostDetailModal
        open={!!detailId}
        postId={detailId}
        onClose={onDetailClose}
        onRequestEdit={(post) => { setDetailId(null); setForm({ open: true, editing: post }); }}
      />
    </div>
  );
}
