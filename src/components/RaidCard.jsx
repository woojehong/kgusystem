import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { formatTimeRange, getCaps, readableOn } from '../lib/utils';

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
 * Position capacity bar — colour-coded by role, with the headcount (e.g. 0/2)
 * centered on the bar. White text + outline stays readable on any fill colour.
 * Turns gold when the position is full.
 */
function CapacityBar({ label, current, cap, color }) {
  const full = cap > 0 && current >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round((current / cap) * 100)) : 0;
  return (
    <div className="flex items-center gap-1.5" title={`${label} ${current}/${cap}`}>
      <span className="text-[10px] font-black w-3 text-center shrink-0 text-outline" style={{ color: full ? GOLD : color }}>
        {label}
      </span>
      <div className="relative flex-1 h-5 rounded-full bg-base-900/70 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: full ? '100%' : `${pct}%`,
            backgroundColor: full ? GOLD : color,
            boxShadow: full ? `0 0 6px ${GOLD}aa` : 'none',
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white text-outline">
          {current}/{cap}
        </span>
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
  const applyColor = mine?.classColor || '#6366f1';

  return (
    <Link
      to={`/raid/${raid.id}`}
      className="relative block card overflow-hidden hover:-translate-y-0.5 transition-all"
      style={{
        backgroundColor: diff.soft,
        // 미신청: 같은 색 옅게(거의 안 보이게) · 신청: 같은 색 진하게(눈에 띄게)
        border: `2px solid ${mine ? diff.color : `${diff.color}22`}`,
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />

      {/* 마감 리본 — 중앙 상단 */}
      {allFull && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-b-lg text-[10px] font-black text-base-900 z-10 shadow"
          style={{ backgroundColor: GOLD }}
        >
          마감
        </span>
      )}

      {/* 신청 표시 — 우측 상단, 신청한 클래스 컬러 (마감돼도 유지) */}
      {mine && (
        <span
          className="absolute top-2 right-2 z-20 text-[10px] px-2 py-0.5 rounded-full font-extrabold shadow"
          style={{ backgroundColor: applyColor, color: readableOn(applyColor) }}
        >
          {mine.status === 'active' ? '신청함' : '대기중'}
        </span>
      )}

      <div className="p-4 pl-5">
        {/* Category (가운데 · 크게) */}
        <p className="text-sm font-bold tracking-wide text-base-300 uppercase mb-1 text-center">
          {partyTypeLabel(raid.partyType, guilds)}
        </p>

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
