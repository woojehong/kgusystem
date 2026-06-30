import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CLASSES, SYNERGIES, SERVERS, SEED_GUILDS } from './constants';

// ── Game data (single-document collections, editable post-seed) ─────

export async function loadGamedata() {
  const [classesSnap, synergiesSnap, serversSnap] = await Promise.all([
    getDoc(doc(db, 'gamedata', 'classes')),
    getDoc(doc(db, 'gamedata', 'synergies')),
    getDoc(doc(db, 'gamedata', 'servers')),
  ]);
  return {
    classes: classesSnap.exists() ? classesSnap.data().list : CLASSES,
    synergies: synergiesSnap.exists() ? synergiesSnap.data().list : SYNERGIES,
    servers: serversSnap.exists() ? serversSnap.data().list : SERVERS,
  };
}

/** One-time initial data install, triggered from the super admin page. */
export async function seedInitialData() {
  const batch = writeBatch(db);
  batch.set(doc(db, 'gamedata', 'classes'), { list: CLASSES });
  batch.set(doc(db, 'gamedata', 'synergies'), { list: SYNERGIES });
  batch.set(doc(db, 'gamedata', 'servers'), { list: SERVERS });
  SEED_GUILDS.forEach((g) => {
    const { id, ...rest } = g;
    // merge: true preserves any edits (name, color, showInFilter, etc.) made after seeding
    batch.set(doc(db, 'guilds', id), { ...rest, createdAt: serverTimestamp() }, { merge: true });
  });
  batch.set(doc(db, 'meta', 'seed'), { done: true, at: serverTimestamp() });
  await batch.commit();
}

export async function isSeeded() {
  const snap = await getDoc(doc(db, 'meta', 'seed'));
  return snap.exists();
}

// ── Guilds ──────────────────────────────────────────────────────────

export async function fetchGuilds() {
  const snap = await getDocs(collection(db, 'guilds'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function saveGuild(guildId, data) {
  return setDoc(doc(db, 'guilds', guildId), data, { merge: true });
}

export function deleteGuild(guildId) {
  return deleteDoc(doc(db, 'guilds', guildId));
}

// ── Raids ───────────────────────────────────────────────────────────

export async function createRaid(data) {
  const ref = await addDoc(collection(db, 'raids'), {
    ...data,
    startAt: Timestamp.fromDate(data.startAt),
    endAt: Timestamp.fromDate(data.endAt),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateRaid(raidId, data) {
  const payload = { ...data };
  if (payload.startAt instanceof Date) payload.startAt = Timestamp.fromDate(payload.startAt);
  if (payload.endAt instanceof Date) payload.endAt = Timestamp.fromDate(payload.endAt);
  return updateDoc(doc(db, 'raids', raidId), payload);
}

/** Soft-delete: marks the raid as deleted without removing data. */
export function softDeleteRaid(raidId) {
  return updateDoc(doc(db, 'raids', raidId), {
    deleted: true,
    deletedAt: serverTimestamp(),
  });
}

/** Restore a soft-deleted raid. */
export function restoreRaid(raidId) {
  return updateDoc(doc(db, 'raids', raidId), {
    deleted: false,
    deletedAt: null,
  });
}

/** Hard-delete: permanently removes raid, apps, and memos. Super-admin only. */
export async function hardDeleteRaid(raidId) {
  const apps = await getDocs(collection(db, 'raids', raidId, 'apps'));
  const memos = await getDocs(collection(db, 'raids', raidId, 'memos'));
  const batch = writeBatch(db);
  apps.docs.forEach((d) => batch.delete(d.ref));
  memos.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'raids', raidId));
  await batch.commit();
}

// ── Applications ────────────────────────────────────────────────────

export function appDocRef(raidId, appId) {
  return doc(db, 'raids', raidId, 'apps', appId);
}

export function memoDocRef(raidId, appId) {
  return doc(db, 'raids', raidId, 'memos', appId);
}

export async function submitApplication(raidId, appId, appData, memoText) {
  const batch = writeBatch(db);
  batch.set(appDocRef(raidId, appId), {
    ...appData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (memoText && memoText.trim()) {
    batch.set(memoDocRef(raidId, appId), { text: memoText.trim(), updatedAt: serverTimestamp() });
  } else {
    batch.delete(memoDocRef(raidId, appId));
  }
  await batch.commit();
}

export async function updateApplication(raidId, appId, appData, memoText) {
  const batch = writeBatch(db);
  batch.update(appDocRef(raidId, appId), { ...appData, updatedAt: serverTimestamp() });
  if (memoText !== undefined) {
    if (memoText && memoText.trim()) {
      batch.set(memoDocRef(raidId, appId), { text: memoText.trim(), updatedAt: serverTimestamp() });
    } else {
      batch.delete(memoDocRef(raidId, appId));
    }
  }
  await batch.commit();
}

export async function cancelApplication(raidId, appId) {
  const batch = writeBatch(db);
  batch.delete(appDocRef(raidId, appId));
  batch.delete(memoDocRef(raidId, appId));
  await batch.commit();
}

export async function fetchMemo(raidId, appId) {
  const snap = await getDoc(memoDocRef(raidId, appId));
  return snap.exists() ? snap.data().text : '';
}

export async function fetchAllMemos(raidId) {
  const snap = await getDocs(collection(db, 'raids', raidId, 'memos'));
  const map = {};
  snap.docs.forEach((d) => {
    map[d.id] = d.data().text;
  });
  return map;
}

// ── User notices (promotion / demotion popups) ──────────────────────

export function setUserNotice(userId, notice) {
  return updateDoc(doc(db, 'users', userId), { notice });
}

export function clearUserNotice(userId) {
  return updateDoc(doc(db, 'users', userId), { notice: null });
}

// ── 길드원 관리 (길드 마스터 전용) ──────────────────────────────────

/** 특정 길드에 소속된 회원 목록. */
export async function fetchUsersByGuild(guildId) {
  const q = query(collection(db, 'users'), where('guildId', '==', guildId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 회원 역할 변경 (user ↔ admin). super는 이 경로로 설정 불가. */
export function setMemberRole(userId, role) {
  return updateDoc(doc(db, 'users', userId), { role });
}

/** 공대장 가능 토글. */
export function setMemberLeaderCapable(userId, leaderCapable) {
  return updateDoc(doc(db, 'users', userId), { leaderCapable: !!leaderCapable });
}

/** 회원 소속 길드 변경 (제명 = none, 데려오기 = 내 길드). */
export function setMemberGuild(userId, guildId) {
  return updateDoc(doc(db, 'users', userId), { guildId });
}
