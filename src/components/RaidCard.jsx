import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { formatTimeRange, getCaps, getUnionGuild } from '../lib/utils';
import GuildBadge from './GuildBadge';

// Role colours shared across the app (tank / healer / dps).
const ROLE_META = [
  { key: 'tank', label: 'T', color: '#38bdf8' },
  { key: 'healer', label: 'H', color: '#34d399' },
  { key: 'dps', label: 'D', color: '#fb7185' },
];
const GOLD = '#fbbf24';

/** True when a raid is a 연합(union) raid rather than a single-guild raid. */
function isUnionRaid(partyType) {
  return !partyType || partyType === 'union';
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** Date parts: { label: '6월 19일', wd: '금', dow: 5 } */
function dateParts(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return { label: `${m}월 ${d}일`, wd: WEEKDAYS[dow], dow };
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
        // 신청 여부와 무관하게 테두리 고정 (신청 표시는 우측 상단 배지로)
        border: `2px solid ${diff.color}22`,
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />

      {/* FULL 표시 — 중앙 상단, 빨강 */}
      {allFull && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-b-lg text-[11px] font-black text-white text-outline z-10 shadow"
          style={{ backgroundColor: '#ef4444' }}
        >
          FULL
        </span>
      )}

      {/* 신청 표시 — 우측 상단, 신청한 클래스 컬러 (마감돼도 유지) */}
      {mine && (
        <span
          className="absolute top-2 right-2 z-20 text-[11px] px-2 py-0.5 rounded-full font-extrabold shadow text-white text-outline"
          style={{ backgroundColor: applyColor }}
        >
          {mine.status === 'active' ? '신청함' : '대기중'}
        </span>
      )}

      <div className="p-4 pl-5">
        {/* 파티 성격 뱃지 — 연합이면 연합 뱃지, 단일 길드면 그 길드 뱃지 (실시간) */}
        <div className="flex justify-center mb-2">
          {isUnionRaid(raid.partyType) ? (
            (() => {
              const u = getUnionGuild(guilds);
              return <GuildBadge guildName={u.badgeName || u.name} guildColor={u.color} badgeConfig={u.badge} size="sm" />;
            })()
          ) : (
            <GuildBadge guildId={raid.partyType} size="sm" />
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
          {(() => {
            const { label, wd, dow } = dateParts(raid.dateKey);
            const wdColor = dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : '#ffffff';
            return (
              <span className="text-base font-bold text-white text-outline">
                {label} <span style={{ color: wdColor }}>({wd})</span>
              </span>
            );
          })()}
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
