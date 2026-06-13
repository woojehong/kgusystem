import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import Header from '../components/Header';
import RaidCard from '../components/RaidCard';
import CalendarGrid from '../components/CalendarGrid';
import RaidFormModal from '../components/RaidFormModal';

const VIEW_MODE_KEY = 'kwgu_view_mode';

export default function IndexPage() {
  const { isAdmin, adminMode, guilds, authReady } = useApp();

  const [raids, setRaids] = useState([]);
  const [counts, setCounts] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [formDateKey, setFormDateKey] = useState(null); // null = today default in modal
  const [now, setNow] = useState(() => Date.now());

  // View mode: 'calendar' | 'card' — persists in localStorage, independent of adminMode.
  // Initialises from localStorage. If no stored value AND auth just resolved as admin → calendar.
  const [viewMode, setViewMode] = useState(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'calendar' || stored === 'card') return stored;
    return 'card'; // safe default; corrected below once auth resolves
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

  // Apply category + difficulty filters (card view only)
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

  // Headcounts per raid for the cards
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        activeRaids.map(async (raid) => {
          try {
            const snap = await getDocs(collection(db, 'raids', raid.id, 'apps'));
            const c = { tank: 0, healer: 0, dps: 0 };
            snap.docs.forEach((d) => {
              const a = d.data();
              if (a.status === 'active' && c[a.role] !== undefined) c[a.role] += 1;
            });
            return [raid.id, c];
          } catch {
            return [raid.id, { tank: 0, healer: 0, dps: 0 }];
          }
        })
      );
      if (!cancelled) setCounts(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [raids.length, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchView = (mode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const openFormForDate = (key) => {
    setFormDateKey(key);
    setFormOpen(true);
  };

  const openFormNew = () => {
    setFormDateKey(null); // modal defaults to today
    setFormOpen(true);
  };

  const showAdmin = isAdmin && adminMode;
  const isCalendar = viewMode === 'calendar';

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="max-w-6xl mx-auto px-4 mt-6">

        {/* ── Filter bar + view toggle ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">

          {/* Category filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: 'all', label: '전체' },
              { key: 'union', label: '연합' },
              ...filterGuilds.map((g) => ({ key: g.id, label: g.name })),
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  categoryFilter === key
                    ? 'bg-indigo-500 text-white'
                    : 'bg-base-800 text-base-400 hover:text-base-200 border border-base-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Difficulty filter */}
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: '전체' },
              ...Object.values(DIFFICULTIES).map((d) => ({ key: d.id, label: d.label })),
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDiffFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  diffFilter === key
                    ? 'bg-base-600 text-white'
                    : 'bg-base-800 text-base-400 hover:text-base-200 border border-base-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle — right-aligned */}
          <div className="ml-auto flex items-center gap-1 p-1 rounded-xl bg-base-850 border border-base-700">
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

        {/* ── Content ── */}
        {isCalendar ? (
          <CalendarGrid
            raids={activeRaids}
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
                  + 레이드 추가
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
                    <RaidCard raid={raid} counts={counts[raid.id]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <RaidFormModal
        open={formOpen}
        dateKey={formDateKey || undefined}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
