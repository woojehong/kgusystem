import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import Header from '../components/Header';
import RaidCard from '../components/RaidCard';
import CalendarGrid from '../components/CalendarGrid';
import GuildFlags from '../components/GuildFlags';
import RaidFormModal from '../components/RaidFormModal';

const VIEW_MODE_KEY = 'kwgu_view_mode';

// ── Filter pill helpers ──────────────────────────────────────────────

/**
 * Returns inline style for an ACTIVE category pill.
 * - 전체 (all)  : plain white
 * - 연합 (union): KWGU-logo gradient (white → base-400)
 * - guild        : guild signature color
 */
function categoryActiveStyle(key, guilds) {
  if (key === 'all') {
    return { backgroundColor: '#ffffff', color: '#0f172a' };
  }
  if (key === 'union') {
    return {
      background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
      color: '#0f172a',
    };
  }
  const guild = guilds.find((g) => g.id === key);
  return guild
    ? { backgroundColor: guild.color, color: '#ffffff' }
    : { backgroundColor: '#6366f1', color: '#ffffff' };
}

/**
 * Returns inline style for an ACTIVE difficulty pill.
 * - 전체 (all): plain white
 * - others    : difficulty color
 */
function diffActiveStyle(key) {
  if (key === 'all') {
    return { backgroundColor: '#ffffff', color: '#0f172a' };
  }
  const diff = DIFFICULTIES[key];
  return diff
    ? { backgroundColor: diff.color, color: '#0f172a' }
    : { backgroundColor: '#6366f1', color: '#ffffff' };
}

// ── Page ─────────────────────────────────────────────────────────────

export default function IndexPage() {
  const { isAdmin, adminMode, guilds, authReady, userId } = useApp();

  const [raids, setRaids] = useState([]);
  const [counts, setCounts] = useState({});
  const [myStatus, setMyStatus] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [formDateKey, setFormDateKey] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // View mode: 'calendar' | 'card' — persists in localStorage
  const [viewMode, setViewMode] = useState(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'calendar' || stored === 'card') return stored;
    return 'card'; // corrected below once auth resolves
  });
  const viewInitialized = useRef(false);
  useEffect(() => {
    if (authReady && !viewInitialized.current) {
      viewInitialized.current = true;
      if (!localStorage.getItem(VIEW_MODE_KEY) && isAdmin) {
        setViewMode('calendar');
      }
    }
  }, [authReady, isAdmin]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');

  // Refresh "now" every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Live raid listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'raids'), (snap) => {
      setRaids(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Active (not ended, not soft-deleted), soonest first
  const activeRaids = useMemo(
    () =>
      raids
        .filter((r) => !r.deleted && r.endAt && r.endAt.toMillis() > now)
        .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis()),
    [raids, now]
  );

  // Guilds with showInFilter=true for the category filter
  const filterGuilds = useMemo(
    () => guilds.filter((g) => !g.isNone && g.showInFilter),
    [guilds]
  );

  // Category + difficulty filters — applied to BOTH calendar and card views
  const filteredRaids = useMemo(
    () =>
      activeRaids
        .filter((r) => {
          if (categoryFilter === 'all') return true;
          if (categoryFilter === 'union') return !r.partyType || r.partyType === 'union';
          return r.partyType === categoryFilter;
        })
        .filter((r) => {
          if (diffFilter === 'all') return true;
          return r.difficulty === diffFilter;
        }),
    [activeRaids, categoryFilter, diffFilter]
  );

  // Live headcounts per raid for the cards. One realtime listener per active
  // raid keeps the 탱/힐/딜 numbers in sync the instant an application changes,
  // and only reads the documents that actually change (cheaper than polling).
  const activeIdsKey = useMemo(
    () => activeRaids.map((r) => r.id).join(','),
    [activeRaids]
  );

  useEffect(() => {
    const ids = activeIdsKey ? activeIdsKey.split(',') : [];
    if (ids.length === 0) {
      setCounts({});
      return undefined;
    }
    const unsubs = ids.map((id) =>
      onSnapshot(
        collection(db, 'raids', id, 'apps'),
        (snap) => {
          const c = { tank: 0, healer: 0, dps: 0 };
          snap.docs.forEach((d) => {
            const a = d.data();
            if (a.status === 'active' && c[a.role] !== undefined) c[a.role] += 1;
          });
          setCounts((prev) => ({ ...prev, [id]: c }));

          // Whether the current user has an application on this raid (with the
          // class colour they applied with, for the highlight/indicator).
          const myDoc = userId ? snap.docs.find((d) => d.id === userId) : null;
          const md = myDoc ? myDoc.data() : null;
          setMyStatus((prev) => ({
            ...prev,
            [id]: md ? { status: md.status, classColor: md.classColor || null } : undefined,
          }));
        },
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [activeIdsKey, userId]);

  const switchView = (mode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const openFormForDate = (key) => {
    setFormDateKey(key);
    setFormOpen(true);
  };

  const openFormNew = () => {
    setFormDateKey(null);
    setFormOpen(true);
  };

  const showAdmin = isAdmin && adminMode;
  const isCalendar = viewMode === 'calendar';

  // Category pill definitions
  const categoryPills = [
    { key: 'all', label: '전체' },
    { key: 'union', label: '연합' },
    ...filterGuilds.map((g) => ({ key: g.id, label: g.name })),
  ];

  // Difficulty pill definitions
  const diffPills = [
    { key: 'all', label: '전체' },
    ...Object.values(DIFFICULTIES).map((d) => ({ key: d.id, label: d.label })),
  ];

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="max-w-6xl mx-auto px-4 mt-5">

        {/* ── 섹션 타이틀 ── */}
        <div className="flex items-center gap-3 mb-5">
          <span className="flex-1 h-px bg-base-700/70" />
          <h2 className="text-sm font-bold text-base-400 tracking-wider">레이드 일정</h2>
          <span className="flex-1 h-px bg-base-700/70" />
        </div>

        {/* ── Filter rows ── */}
        <div className="space-y-2 mb-5">

          {/* Row 1: 구분 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-base-400 w-8 shrink-0">구분</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {categoryPills.map(({ key, label }) => {
                const isActive = categoryFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoryFilter(key)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                    style={
                      isActive
                        ? { ...categoryActiveStyle(key, filterGuilds), borderColor: 'transparent' }
                        : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#334155' }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: 난이도 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-base-400 w-8 shrink-0">난이도</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {diffPills.map(({ key, label }) => {
                const isActive = diffFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDiffFilter(key)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                    style={
                      isActive
                        ? { ...diffActiveStyle(key), borderColor: 'transparent' }
                        : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#334155' }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* View toggle — right end of 난이도 row */}
            <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-base-850 border border-base-700">
              <button
                type="button"
                onClick={() => switchView('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isCalendar ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
                }`}
              >
                달력뷰
              </button>
              <button
                type="button"
                onClick={() => switchView('card')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  !isCalendar ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
                }`}
              >
                카드뷰
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {isCalendar ? (
          <CalendarGrid
            raids={filteredRaids}
            counts={counts}
            mineMap={myStatus}
            onCreate={openFormForDate}
            isAdmin={showAdmin}
          />
        ) : (
          <>
            {showAdmin && (
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={openFormNew}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-500/40 text-indigo-200 text-sm font-semibold transition"
                >
                  + 일정 추가
                </button>
              </div>
            )}

            {filteredRaids.length === 0 ? (
              <p className="text-center text-base-400 py-20">예정된 레이드가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                {filteredRaids.map((raid) => (
                  <div
                    key={raid.id}
                    className="w-[calc(50%-0.375rem)] sm:w-[calc(25%-0.75rem)] min-w-[150px]"
                  >
                    <RaidCard raid={raid} counts={counts[raid.id]} mine={myStatus[raid.id]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 길드 깃발 (달력/카드 아래) ── */}
        <GuildFlags />
      </main>

      <RaidFormModal
        open={formOpen}
        dateKey={formDateKey || undefined}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
