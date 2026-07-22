import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { useApp } from '../context/AppContext';
import GuildBadge from './GuildBadge';
import {
  CAT_LABEL,
  subscribePost,
  subscribeComments,
  addComment,
  updateComment,
  deleteComment,
  deletePost,
} from '../lib/board';

function fmt(ts) {
  if (!ts || !ts.toDate) return '';
  const d = ts.toDate();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AuthorLine({ a, time }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      {a.authorIsMaster && <span title="길드 마스터">👑</span>}
      <span className="font-semibold text-base-200">{a.authorNickname || '알 수 없음'}</span>
      <GuildBadge guildId={a.authorGuildId} size="xs" />
      {(a.authorRole === 'admin' || a.authorRole === 'super') && (
        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold border border-amber-500/30">관리자</span>
      )}
      {time && <span className="text-base-500">· {time}</span>}
    </div>
  );
}

// 게시글 본문 + 댓글. onRequestEdit(post) → 상위에서 수정 모달 오픈.
export default function PostDetailModal({ open, postId, onClose, onRequestEdit }) {
  const { userId, role, isSuper, profile } = useApp();
  const toast = useToast();

  // 삭제 권한: 본인 / 슈퍼 / 마스터(전부) / 관리자(자기 길드 일반 길드원)
  const canDeleteAuthored = (a) =>
    !!a && (
      a.authorId === userId
      || isSuper
      || !!profile?.isGuildMaster
      || (role === 'admin' && a.authorGuildId === profile?.guildId && a.authorRole === 'user' && !a.authorIsMaster)
    );
  // 수정 권한: 본인 또는 슈퍼
  const canEditAuthored = (a) => !!a && (a.authorId === userId || isSuper);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (!open || !postId) return undefined;
    setPost(null);
    setComments([]);
    setText('');
    setConfirmDel(false);
    const unsub1 = subscribePost(postId, setPost);
    const unsub2 = subscribeComments(postId, setComments);
    return () => { unsub1(); unsub2(); };
  }, [open, postId]);

  const canEditPost = canEditAuthored(post);
  const canDeletePost = canDeleteAuthored(post);

  const startEditComment = (c) => { setEditingId(c.id); setEditText(c.body); };
  const saveEditComment = async () => {
    if (!editText.trim() || busy) return;
    setBusy(true);
    try { await updateComment(postId, editingId, editText); setEditingId(null); setEditText(''); }
    catch { toast('댓글 수정 실패'); }
    finally { setBusy(false); }
  };

  const submitComment = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(postId, {
        body: text,
        author: {
          userId,
          nickname: profile?.nickname,
          guildId: profile?.guildId,
          role: profile?.role,
          isGuildMaster: profile?.isGuildMaster,
        },
      });
      setText('');
    } catch {
      toast('댓글 등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (cid) => {
    try { await deleteComment(postId, cid); } catch { toast('댓글 삭제 실패'); }
  };

  const removePost = async () => {
    setBusy(true);
    try {
      await deletePost(postId);
      toast('게시글을 삭제했습니다');
      onClose(true);
    } catch {
      toast('삭제 실패 — 권한을 확인해주세요');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} title={null} maxWidth="max-w-2xl">
      {!post ? (
        <div className="py-12 text-center text-base-500 text-sm">불러오는 중…</div>
      ) : (
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="space-y-2 pb-3 border-b border-base-700">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                post.category === 'notice'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-base-700 text-base-300 border-base-600'
              }`}>
                {post.pinned ? '📌 ' : ''}{CAT_LABEL[post.category] || post.category}
              </span>
              <h2 className="text-lg font-bold leading-tight flex-1">{post.title}</h2>
            </div>
            <div className="flex items-center justify-between gap-2">
              <AuthorLine a={post} time={fmt(post.createdAt)} />
              {(canEditPost || canDeletePost) && (
                <div className="flex items-center gap-1 shrink-0">
                  {canEditPost && (
                    <button type="button" onClick={() => onRequestEdit(post)} className="text-xs text-base-400 hover:text-base-100 px-2 py-1 rounded hover:bg-base-700">수정</button>
                  )}
                  {canDeletePost && (
                    <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">삭제</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 본문 */}
          <div className="text-sm text-base-200 leading-relaxed whitespace-pre-wrap min-h-[60px]">{post.body}</div>

          {confirmDel && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-2">
              <span className="text-sm text-red-200">이 게시글과 댓글을 삭제할까요?</span>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="btn-ghost px-3 py-1 text-sm" onClick={() => setConfirmDel(false)}>취소</button>
                <button type="button" className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50" disabled={busy} onClick={removePost}>삭제</button>
              </div>
            </div>
          )}

          {/* 댓글 */}
          <div className="pt-2">
            <p className="text-sm font-bold text-base-100 mb-3">댓글 <span className="text-base-500">{post.commentCount || 0}</span></p>
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-base-500 text-center py-3">첫 댓글을 남겨보세요.</p>
              ) : comments.map((c) => {
                const editable = canEditAuthored(c);
                const deletable = canDeleteAuthored(c);
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="rounded-xl bg-base-850 border border-base-700 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <AuthorLine a={c} time={fmt(c.createdAt)} />
                      {!isEditing && (editable || deletable) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {editable && (
                            <button type="button" onClick={() => startEditComment(c)} className="text-[11px] text-base-400 hover:text-base-100 px-1.5 py-0.5 rounded hover:bg-base-700">수정</button>
                          )}
                          {deletable && (
                            <button type="button" onClick={() => removeComment(c.id)} className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10">삭제</button>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea className="input-base w-full min-h-[60px] resize-y" value={editText} maxLength={2000} onChange={(e) => setEditText(e.target.value)} />
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => { setEditingId(null); setEditText(''); }}>취소</button>
                          <button type="button" className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50" disabled={busy || !editText.trim()} onClick={saveEditComment}>저장</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-base-200 leading-relaxed whitespace-pre-wrap mt-1.5">{c.body}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 입력 */}
            <div className="mt-3 flex gap-2">
              <textarea
                className="input-base flex-1 min-h-[44px] max-h-40 resize-y"
                placeholder="댓글을 입력하세요"
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
              />
              <button type="button" className="btn-primary px-4 shrink-0 self-stretch" disabled={busy || !text.trim()} onClick={submitComment}>등록</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
