import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { useApp } from '../context/AppContext';
import { CATEGORIES, createPost, updatePost } from '../lib/board';

// 게시글 작성/수정. editing=게시글 객체면 수정, 없으면 신규.
export default function PostFormModal({ open, onClose, editing, defaultCategory = 'free' }) {
  const { userId, profile, isAdmin } = useApp();
  const toast = useToast();
  const canNotice = isAdmin || !!profile?.isGuildMaster;

  const isEdit = !!editing;
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (isEdit) {
      setCategory(editing.category);
      setTitle(editing.title || '');
      setBody(editing.body || '');
      setPinned(!!editing.pinned);
    } else {
      // 공지 작성 권한 없으면 공지 카테고리는 기본값에서 제외
      const initial = defaultCategory === 'notice' && !canNotice ? 'free' : defaultCategory;
      setCategory(initial);
      setTitle('');
      setBody('');
      setPinned(false);
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = CATEGORIES.filter((c) => !c.noticeOnly || canNotice);

  const submit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!body.trim()) { setError('내용을 입력해주세요.'); return; }
    if (category === 'notice' && !canNotice) { setError('공지 작성 권한이 없습니다.'); return; }
    setBusy(true);
    try {
      const author = {
        userId,
        nickname: profile?.nickname,
        guildId: profile?.guildId,
        role: profile?.role,
        isGuildMaster: profile?.isGuildMaster,
      };
      if (isEdit) {
        await updatePost(editing.id, { title, body, category, pinned: category === 'notice' ? pinned : false });
        toast('게시글을 수정했습니다 ✓');
      } else {
        await createPost({ category, title, body, pinned, author });
        toast('게시글을 등록했습니다 ✓');
      }
      onClose(true);
    } catch {
      setError('저장에 실패했습니다. 권한을 확인해주세요.');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} title={isEdit ? '게시글 수정' : '글쓰기'}>
      <div className="space-y-4">
        <div>
          <label className="label-sm">분류</label>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition ${
                  category === c.id
                    ? c.id === 'notice'
                      ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                      : 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                    : 'border-base-700 text-base-400 hover:text-base-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-sm">제목</label>
          <input className="input-base" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" maxLength={120} />
        </div>

        <div>
          <label className="label-sm">내용</label>
          <textarea
            className="input-base min-h-[180px] resize-y leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용을 입력하세요"
            maxLength={8000}
          />
        </div>

        {category === 'notice' && canNotice && (
          <label className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-amber-200">📌 상단 고정</p>
              <p className="text-[11px] text-base-400 mt-0.5">모든 게시판 화면 최상단에 상시 노출됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`relative w-11 h-6 rounded-full transition shrink-0 ${pinned ? 'bg-amber-500' : 'bg-base-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${pinned ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? '처리 중...' : isEdit ? '수정 완료' : '등록'}
        </button>
      </div>
    </Modal>
  );
}
