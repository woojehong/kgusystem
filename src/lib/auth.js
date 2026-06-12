import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, createAuthAccountIsolated } from '../firebase';
import { padPin, validateNickname } from './constants';
import { randomId } from './utils';

const AUTH_DOMAIN = 'kgu.com';

function newAuthEmail() {
  return `u${randomId()}@${AUTH_DOMAIN}`;
}

export async function lookupNickname(nickname) {
  const snap = await getDoc(doc(db, 'nicknames', nickname));
  return snap.exists() ? snap.data() : null;
}

/**
 * Registers a new member. Creates the Firebase Auth account, then the
 * profile / nickname mapping / auth link documents in a single batch.
 */
export async function signUp({ nickname, pin, guildId, character, leaderCapable }) {
  if (!validateNickname(nickname)) {
    throw new Error('닉네임 형식이 올바르지 않습니다.');
  }
  const existing = await lookupNickname(nickname);
  if (existing) throw new Error('이미 사용 중인 닉네임입니다.');

  const authEmail = newAuthEmail();
  const cred = await createUserWithEmailAndPassword(auth, authEmail, padPin(pin));
  const authUid = cred.user.uid;
  const userId = randomId('user_');

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId), {
    nickname,
    guildId,
    role: 'user',
    leaderCapable: !!leaderCapable,
    characters: [character],
    mainCharIndex: 0,
    notice: null,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'nicknames', nickname), { userId, authEmail });
  batch.set(doc(db, 'authlinks', authUid), { userId });
  await batch.commit();
  return userId;
}

export async function signIn(nickname, pin) {
  const mapping = await lookupNickname(nickname);
  if (!mapping) throw new Error('등록되지 않은 닉네임입니다.');
  try {
    await signInWithEmailAndPassword(auth, mapping.authEmail, padPin(pin));
  } catch (e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      throw new Error('PIN이 올바르지 않습니다.');
    }
    if (e.code === 'auth/too-many-requests') {
      throw new Error('시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }
    throw e;
  }
  return mapping.userId;
}

export function signOutUser() {
  return fbSignOut(auth);
}

export async function changePin(currentPin, newPin) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const credential = EmailAuthProvider.credential(user.email, padPin(currentPin));
  try {
    await reauthenticateWithCredential(user, credential);
  } catch {
    throw new Error('현재 PIN이 올바르지 않습니다.');
  }
  await updatePassword(user, padPin(newPin));
}

/**
 * Renames a member. The auth account is untouched; only the nickname
 * mapping document is swapped and the profile updated.
 */
export async function changeNickname(userId, oldNickname, newNickname) {
  if (!validateNickname(newNickname)) {
    throw new Error('닉네임 형식이 올바르지 않습니다.');
  }
  if (oldNickname === newNickname) return;
  const taken = await lookupNickname(newNickname);
  if (taken) throw new Error('이미 사용 중인 닉네임입니다.');
  const mapping = await lookupNickname(oldNickname);
  if (!mapping || mapping.userId !== userId) {
    throw new Error('계정 정보를 확인할 수 없습니다.');
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'nicknames', newNickname), mapping);
  batch.delete(doc(db, 'nicknames', oldNickname));
  batch.update(doc(db, 'users', userId), { nickname: newNickname });
  await batch.commit();
}

/**
 * Super admin PIN reset. Issues a fresh internal auth account with a
 * temporary PIN and re-points the nickname mapping to it. The old auth
 * account becomes an unreferenced orphan (harmless).
 */
export async function resetPinBySuper(nickname, tempPin) {
  const mapping = await lookupNickname(nickname);
  if (!mapping) throw new Error('해당 닉네임을 찾을 수 없습니다.');

  const authEmail = newAuthEmail();
  const newAuthUid = await createAuthAccountIsolated(authEmail, padPin(tempPin));

  const batch = writeBatch(db);
  batch.set(doc(db, 'nicknames', nickname), { userId: mapping.userId, authEmail });
  batch.set(doc(db, 'authlinks', newAuthUid), { userId: mapping.userId });
  await batch.commit();
}

/**
 * One-time super admin bootstrap, available only while meta/super
 * does not exist yet (enforced again by security rules).
 */
export async function createSuperAccount(nickname, pin) {
  if (!validateNickname(nickname)) {
    throw new Error('닉네임 형식이 올바르지 않습니다.');
  }
  const metaSnap = await getDoc(doc(db, 'meta', 'super'));
  if (metaSnap.exists()) throw new Error('슈퍼관리자 계정이 이미 존재합니다.');

  const authEmail = newAuthEmail();
  const cred = await createUserWithEmailAndPassword(auth, authEmail, padPin(pin));
  const userId = randomId('super_');

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId), {
    nickname,
    guildId: 'none',
    role: 'super',
    leaderCapable: false,
    characters: [],
    mainCharIndex: 0,
    notice: null,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'nicknames', nickname), { userId, authEmail });
  batch.set(doc(db, 'authlinks', cred.user.uid), { userId });
  batch.set(doc(db, 'meta', 'super'), { userId, createdAt: serverTimestamp() });
  await batch.commit();
  return userId;
}

export async function resolveUserId(authUid) {
  const snap = await getDoc(doc(db, 'authlinks', authUid));
  return snap.exists() ? snap.data().userId : null;
}

export async function ensureAuthlink(authUid, userId) {
  await setDoc(doc(db, 'authlinks', authUid), { userId });
}
