import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── 게시판 카테고리 ──────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 'notice', label: '공지', noticeOnly: true }, // 작성: 관리자·마스터 전용
  { id: 'free', label: '자유' },
  { id: 'recruit', label: '구인구직' },
];
// 게시판 상단 탭 — '전체'가 기본. (전체는 열람 전용 필터이지 작성 분류는 아님)
export const BOARD_TABS = [{ id: 'all', label: '전체' }, ...CATEGORIES];
export const CAT_LABEL = { notice: '공지', free: '자유', recruit: '구인구직' };

const PAGE = 20;

// 작성자 표시 스냅샷 — 글/댓글 문서에 함께 저장(비정규화)해 목록에서 추가 읽기 없이 표시.
function authorFields(author) {
  return {
    authorId: author.userId,
    authorNickname: author.nickname || '',
    authorGuildId: author.guildId || 'none',
    authorRole: author.role || 'user',
    authorIsMaster: !!author.isGuildMaster,
  };
}

// ── 목록 (카테고리별 최신순, 페이지네이션) ───────────────────────────
// afterDoc 을 넘기면 다음 페이지. get 기반(1회 읽기)으로 비용 절약.
export async function fetchPosts(category, afterDoc) {
  const col = collection(db, 'posts');
  // '전체'는 카테고리 필터 없이 최신순(단일 필드 인덱스만 필요 → 복합 인덱스 불필요).
  const base = category === 'all'
    ? [col, orderBy('createdAt', 'desc')]
    : [col, where('category', '==', category), orderBy('createdAt', 'desc')];
  const q = afterDoc
    ? query(...base, startAfter(afterDoc), limit(PAGE))
    : query(...base, limit(PAGE));
  const snap = await getDocs(q);
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE,
  };
}

// 상단 고정 공지 (실시간, 소량). 모든 탭 위에 상시 노출.
export function subscribePinnedNotices(cb, max = 5) {
  const q = query(
    collection(db, 'posts'),
    where('category', '==', 'notice'),
    where('pinned', '==', true),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export function subscribePost(postId, cb) {
  return onSnapshot(
    doc(db, 'posts', postId),
    (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    () => cb(null)
  );
}

export async function fetchPost(postId) {
  const s = await getDoc(doc(db, 'posts', postId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// ── 글 CRUD ─────────────────────────────────────────────────────────
export async function createPost({ category, title, body, pinned, author }) {
  const ref = await addDoc(collection(db, 'posts'), {
    category,
    title: title.trim(),
    body: body.trim(),
    pinned: category === 'notice' ? !!pinned : false,
    ...authorFields(author),
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function updatePost(postId, { title, body, pinned, category }) {
  const patch = { updatedAt: serverTimestamp() };
  if (title !== undefined) patch.title = title.trim();
  if (body !== undefined) patch.body = body.trim();
  if (category !== undefined) patch.category = category;
  if (pinned !== undefined) patch.pinned = !!pinned;
  return updateDoc(doc(db, 'posts', postId), patch);
}

// 관리자용 고정 토글 (목록에서 바로).
export function setPinned(postId, pinned) {
  return updateDoc(doc(db, 'posts', postId), { pinned: !!pinned, updatedAt: serverTimestamp() });
}

// 글 삭제 — 댓글까지 배치 정리. (게시글당 댓글 규모는 작다고 가정)
export async function deletePost(postId) {
  const cs = await getDocs(collection(db, 'posts', postId, 'comments'));
  const batch = writeBatch(db);
  cs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'posts', postId));
  await batch.commit();
}

// ── 댓글 ────────────────────────────────────────────────────────────
export function subscribeComments(postId, cb) {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

// 댓글 작성 + 게시글 commentCount +1 (비정규화 — 목록에서 댓글 전체를 읽지 않도록).
export async function addComment(postId, { body, author }) {
  const batch = writeBatch(db);
  const cref = doc(collection(db, 'posts', postId, 'comments'));
  batch.set(cref, { body: body.trim(), ...authorFields(author), createdAt: serverTimestamp() });
  batch.update(doc(db, 'posts', postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(postId, commentId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'posts', postId, 'comments', commentId));
  batch.update(doc(db, 'posts', postId), { commentCount: increment(-1) });
  await batch.commit();
}
