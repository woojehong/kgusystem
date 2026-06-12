import { useEffect, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import RaidCard from '../components/RaidCard';
import CalendarGrid from '../components/CalendarGrid';
import RaidFormModal from '../components/RaidFormModal';

export default function IndexPage() {
  const { isAdmin, adminMode } = useApp();
  const [raids, setRaids] = useState([]);
  const [counts, setCounts] = useState({});
  const [formDateKey, setFormDateKey] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // Refresh "now" every minute so finished raids drop off automatically.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'raids'), (snap) => {
      setRaids(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Active (not yet ended) raids, soonest first.
  const activeRaids = raids
    .filter((r) => r.endAt && r.endAt.toMillis() > now)
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());

  // Confirmed-only headcounts per raid for the cards.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raids.length, now]);

  const showCalendar = isAdmin && adminMode;

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white via-base-100 to-base-400 bg-clip-text text-transparent">
            KGU
          </h1>
          <p className="text-base-400 font-semibold tracking-[0.4em] mt-1">한 길 련</p>
        </div>

        {showCalendar ? (
          <>
            <p className="text-sm text-base-400 mb-3">
              빈 날짜를 클릭하면 레이드를 추가할 수 있습니다. 등록된 레이드를 클릭하면 상세
              페이지로 이동합니다.
            </p>
            <CalendarGrid raids={activeRaids} onCreate={(key) => setFormDateKey(key)} />
          </>
        ) : activeRaids.length === 0 ? (
          <p className="text-center text-base-400 py-20">예정된 레이드가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {activeRaids.map((raid) => (
              <div key={raid.id} className="w-[calc(50%-0.375rem)] sm:w-[calc(25%-0.75rem)] min-w-[150px]">
                <RaidCard raid={raid} counts={counts[raid.id]} />
              </div>
            ))}
          </div>
        )}
      </main>

      <RaidFormModal
        open={!!formDateKey}
        dateKey={formDateKey}
        onClose={() => setFormDateKey(null)}
      />
    </div>
  );
}
