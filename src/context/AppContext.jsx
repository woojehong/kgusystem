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
import { resolveUserId } from '../lib/auth';
import { loadGamedata } from '../lib/db';
import { sortGuilds } from '../lib/utils';
import { CLASSES, SYNERGIES, SERVERS, SEED_GUILDS } from '../lib/constants';

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
  const [adminMode, setAdminModeState] = useState(
    () => localStorage.getItem(ADMIN_MODE_KEY) === 'on'
  );

  const setAdminMode = useCallback((on) => {
    setAdminModeState(on);
    localStorage.setItem(ADMIN_MODE_KEY, on ? 'on' : 'off');
  }, []);

  // Auth session → internal userId
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const uid = await resolveUserId(user.uid).catch(() => null);
        setUserId(uid);
      } else {
        setUserId(null);
        setProfile(null);
      }
      setAuthReady(true);
    });
    return unsub;
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
    };
  }, [authUser, authReady, userId, profile, adminMode, setAdminMode, gamedata, guilds]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
