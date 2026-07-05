import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { loadGamedata } from '../lib/db';
import { sortGuilds } from '../lib/utils';
import { CLASSES, SYNERGIES, SERVERS, SEED_GUILDS, DEFAULT_SUBCATEGORIES } from '../lib/constants';

const AppContext = createContext(null);

const ADMIN_MODE_KEY = 'kgu_admin_mode';

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [gamedata, setGamedata] = useState({
    classes: CLASSES,
    synergies: SYNERGIES,
    servers: SERVERS,
  });
  const [guilds, setGuilds] = useState(SEED_GUILDS.map(({ id, ...g }) => ({ id, ...g })));
  const [subCategories, setSubCategories] = useState(DEFAULT_SUBCATEGORIES);
  const [adminMode, setAdminModeState] = useState(
    () => localStorage.getItem(ADMIN_MODE_KEY) === 'on'
  );

  const setAdminMode = useCallback((on) => {
    setAdminModeState(on);
    localStorage.setItem(ADMIN_MODE_KEY, on ? 'on' : 'off');
  }, []);

  // Auth session → internal userId.
  // We subscribe to the authlinks/{uid} document instead of reading it once,
  // so that sign-up (which writes the link a moment after the auth account is
  // created) resolves the very instant the link is committed. This removes the
  // race that could otherwise leave a freshly registered user stuck on the
  // loading screen until a manual refresh.
  useEffect(() => {
    let unsubLink = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (unsubLink) {
        unsubLink();
        unsubLink = null;
      }
      if (user) {
        unsubLink = onSnapshot(
          doc(db, 'authlinks', user.uid),
          (snap) => {
            setUserId(snap.exists() ? snap.data().userId : null);
            setAuthReady(true);
          },
          () => {
            setUserId(null);
            setAuthReady(true);
          }
        );
      } else {
        setUserId(null);
        setProfile(null);
        setAuthReady(true);
      }
    });
    return () => {
      if (unsubLink) unsubLink();
      unsubAuth();
    };
  }, []);

  // Live profile subscription
  useEffect(() => {
    if (!userId) return undefined;
    const unsub = onSnapshot(
      doc(db, 'users', userId),
      (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setProfile(null)
    );
    return unsub;
  }, [userId]);

  // Game data (loaded once per session)
  useEffect(() => {
    loadGamedata()
      .then(setGamedata)
      .catch(() => {});
  }, [authUser?.uid]);

  // Live guild list
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'guilds'),
      (snap) => {
        if (!snap.empty) {
          setGuilds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      },
      () => {}
    );
    return unsub;
  }, [authUser?.uid]);

  // 관리형 소분류 목록 (Firestore config/raidMeta → 없으면 상수 폴백). 'none'은 항상 포함.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'raidMeta'),
      (snap) => {
        const list = snap.exists() ? snap.data().subCategories : null;
        if (Array.isArray(list) && list.length) {
          const hasNone = list.some((s) => s && s.id === 'none');
          setSubCategories(hasNone ? list : [{ id: 'none', label: '없음(기본)' }, ...list]);
        } else {
          setSubCategories(DEFAULT_SUBCATEGORIES);
        }
      },
      () => setSubCategories(DEFAULT_SUBCATEGORIES)
    );
    return unsub;
  }, [authUser?.uid]);

  const value = useMemo(() => {
    const role = profile?.role || 'user';
    return {
      authUser,
      authReady,
      userId,
      profile,
      role,
      isAdmin: role === 'admin' || role === 'super',
      isSuper: role === 'super',
      adminMode,
      setAdminMode,
      gamedata,
      guilds: sortGuilds(guilds),
      subCategories,
    };
  }, [authUser, authReady, userId, profile, adminMode, setAdminMode, gamedata, guilds, subCategories]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
