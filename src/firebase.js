import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase web configuration.
 * These values are safe to commit (they are public client identifiers).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDiehFiW2DYbEYMb7JzgP7wuMPW7lIvklU',
  authDomain: 'kgusystem.firebaseapp.com',
  projectId: 'kgusystem',
  storageBucket: 'kgusystem.firebasestorage.app',
  messagingSenderId: '1087593117434',
  appId: '1:1087593117434:web:759e368fc9d42d97557b43',
};

const app = initializeApp(firebaseConfig);

// Durable login persistence (IndexedDB → localStorage fallback). Helps keep
// the session on iOS "add to home screen" PWAs where storage is isolated.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
export const db = getFirestore(app);

/**
 * Creates an auth account on a secondary app instance so the
 * current (super admin) session is not replaced by the new account.
 * Returns the new account's auth uid.
 */
export async function createAuthAccountIsolated(email, password) {
  const name = `secondary-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig, name);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await fbSignOut(secondaryAuth);
    return uid;
  } finally {
    const orphan = getApps().find((a) => a.name === name);
    if (orphan) await deleteApp(orphan).catch(() => {});
  }
}
