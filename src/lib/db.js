import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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

// ── 마이그레이션: 기원사 특성명 '파멸' → '황폐' ──────────────────────
// gamedata/classes 재시드 + 기존 신청서(apps)의 특성 '이름' 변환.
// (캐릭터는 특성을 id로 저장하므로 변환 불필요)
export async function migrateEvokerSpecName() {
  const result = { apps: 0 };
  await setDoc(doc(db, 'gamedata', 'classes'), { list: CLASSES });

  const fix = (v) => (v === '파멸' ? '황폐' : v);
  const raidsSnap = await getDocs(collection(db, 'raids'));
  for (const r of raidsSnap.docs) {
    const appsSnap = await getDocs(collection(db, 'raids', r.id, 'apps'));
    for (const a of appsSnap.docs) {
      const d = a.data();
      if (d.classId !== 'evoker') continue;
      const patch = {};
      if (d.specName === '파멸') patch.specName = '황폐';
      if (Array.isArray(d.allSpecNames) && d.allSpecNames.includes('파멸')) {
        patch.allSpecNames = d.allSpecNames.map(fix);
      }
      if (Object.keys(patch).length) {
        await updateDoc(doc(db, 'raids', r.id, 'apps', a.id), patch);
        result.apps += 1;
      }
    }
  }
  return result;
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

// 신청 취소 — 신청서는 삭제(명단에서 사라짐)하고, 취소 기록은 별도 컬렉션에 남긴다.
// 별도 문서라 나중에 재등록해도 취소 이력이 유지된다.
export async function cancelApplication(raidId, appId, appSnapshot, reason) {
  const a = appSnapshot || {};
  const batch = writeBatch(db);
  batch.delete(appDocRef(raidId, appId));
  batch.delete(memoDocRef(raidId, appId));
  batch.set(doc(collection(db, 'raids', raidId, 'cancels')), {
    userId: a.userId || appId,
    nickname: a.nickname || null,
    charName: a.charName || null,
    classId: a.classId || null,
    className: a.className || null,
    classColor: a.classColor || null,
    specId: a.specId || null,
    specName: a.specName || null,
    role: a.role || null,
    guildId: a.guildId || null,
    guildName: a.guildName || null,
    guildColor: a.guildColor || null,
    prevStatus: a.status || null,
    reason: (reason || '').trim() || null,
    cancelledAt: serverTimestamp(),
  });
  await batch.commit();
}

// 취소 기록 삭제 (관리자가 명단에서 제외)
export async function deleteCancelRecord(raidId, cancelId) {
  await deleteDoc(doc(db, 'raids', raidId, 'cancels', cancelId));
}

// 취소자 명단 구독 — 관리자는 전체, 일반 사용자는 본인 것만 (규칙과 동일하게 쿼리 제한).
export function subscribeCancels(raidId, { isAdmin, userId }, cb) {
  const col = collection(db, 'raids', raidId, 'cancels');
  const q = isAdmin ? col : query(col, where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
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
