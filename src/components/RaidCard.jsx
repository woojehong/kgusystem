import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { formatTimeRange, getCaps } from '../lib/utils';

// Role colours shared across the app (tank / healer / dps).
const ROLE_META = [
  { key: 'tank', label: 'T', color: '#38bdf8' },
  { key: 'healer', label: 'H', color: '#34d399' },
  { key: 'dps', label: 'D', color: '#fb7185' },
];
const GOLD = '#fbbf24';

/** Returns the display label for a raid's party type. */
function partyTypeLabel(partyType, guilds) {
  if (!partyType || partyType === 'union') return '연합 길드 레이드';
  const g = guilds.find((guild) => guild.id === partyType);
  return g ? `${g.name} 길드 레이드` : '길드 레이드';
}

/** Short date string: 6/19 (금) */
function shortDate(dateKey) {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(Number(dateKey.split('-')[0]), m - 1, d);
  return `${m}/${d} (${weekdays[date.getDay()]})`;
}

/**
 * Position capacity bar — no numbers, colour-coded by role.
 * Fills proportionally; once the position is full the whole bar turns gold.
 */
function CapacityBar({ label, current, cap, color }) {
  const full = cap > 0 && current >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round((current / cap) * 100)) : 0;
  return (
    <div className="flex items-center gap-1.5" title={`${label} ${current}/${cap}`}>
      <span
        className="text-[10px] font-black w-3 text-center shrink-0"
        style={{ color: full ? GOLD : color }}
      >
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-base-900/70 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: full ? '100%' : `${pct}%`,
            backgroundColor: full ? GOLD : color,
            boxShadow: full ? `0 0 6px ${GOLD}aa` : 'none',
          }}
        />
      </div>
    </div>
  );
}

export default function RaidCard({ raid, counts, mine }) {
  const { guilds } = useApp();
  const diff = DIFFICULTIES[raid.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(raid);
  const startAt = raid.startAt.toDate();
  const endAt = raid.endAt.toDate();

  const allFull = ROLE_META.every((r) => (counts?.[r.key] ?? 0) >= caps[r.key]);

  return (
    <Link
      to={`/raid/${raid.id}`}
      className={`relative block card overflow-hidden hover:border-base-600 hover:-translate-y-0.5 transition-all ${
        mine ? 'ring-1 ring-indigo-400/60' : ''
      }`}
      style={{ backgroundColor: diff.soft }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />

      {/* 마감 리본 (전체 정원 충족 시) */}
      {allFull && (
        <span
          className="absolute -right-9 top-3 rotate-45 px-9 py-0.5 text-[10px] font-black text-base-900 shadow"
          style={{ backgroundColor: GOLD }}
        >
          마감
        </span>
      )}

      <div className="p-4 pl-5">
        {/* Category + 내 신청 표시 */}
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs font-bold tracking-wide text-base-400 uppercase">
            {partyTypeLabel(raid.partyType, guilds)}
          </p>
          {mine && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                mine === 'active'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {mine === 'active' ? '신청함' : '대기중'}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="font-bold text-base leading-snug break-keep">
          {raid.title || `${diff.label} 공격대`}
        </p>

        {/* Difficulty + Date */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
          >
            {diff.label}
          </span>
          <span className="text-sm font-bold text-white">{shortDate(raid.dateKey)}</span>
        </div>

        {/* Time */}
        <p className="mt-1 text-sm font-semibold text-base-200">
          {formatTimeRange(startAt, endAt)}
        </p>

        {/* Leader */}
        <p className="mt-2 pt-2 border-t border-base-700/60 text-sm text-base-300">
          공격대장 : <span className="font-semibold text-base-100">{raid.leader}</span>
        </p>

        {/* 정원 진행바 */}
        <div className="mt-3 space-y-1.5">
          {ROLE_META.map((r) => (
            <CapacityBar
              key={r.key}
              label={r.label}
              current={counts?.[r.key] ?? 0}
              cap={caps[r.key]}
              color={r.color}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
