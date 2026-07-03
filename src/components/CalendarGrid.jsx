import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import {
  buildCalendarWeeks,
  toDateKey,
  WEEKDAYS_KO,
  getCaps,
  formatTimeRange,
  formatDateLabel,
  getUnionGuild,
} from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import GuildBadge from './GuildBadge';

function isUnionRaid(partyType) {
  return !partyType || partyType === 'union';
}

const ROLE_COLORS = { tank: '#38bdf8', healer: '#34d399', dps: '#fb7185' };
const GOLD = '#fbbf24';

// 카드뷰와 같은 그래프 형태의 컴팩트 모집바 (탱/힐/딜 각 한 줄).
function CalBar({ label, cur, cap, color }) {
  const full = cap > 0 && cur >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round((cur / cap) * 100)) : 0;
  return (
    <div className="flex items-center gap-1" title={`${label} ${cur}/${cap}`}>
      <span className="text-[8px] sm:text-[9px] font-black w-2.5 text-center shrink-0 text-outline" style={{ color: full ? GOLD : color }}>
        {label}
      </span>
      <div className="relative flex-1 h-3 sm:h-3.5 rounded-full bg-base-900/70 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: full ? '100%' : `${pct}%`, backgroundColor: full ? GOLD : color }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white text-outline tabular-nums">
          {cur}/{cap}
        </span>
      </div>
    </div>
  );
}

// 달력 칩 (데스크탑 전용) — 접힘(기본)/펼침 2단계.
function RaidChip({ r, count: c, mine, unionGuild }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(r);
  const union = isUnionRaid(r.partyType);
  const go = () => navigate(`/raid/${r.id}`);
  const handleClick = (e) => {
    if (e) e.stopPropagation();
    if (expanded) go();
    else setExpanded(true);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(e); }}
      className="relative cursor-pointer transition hover:brightness-125 px-2 py-2 leading-tight"
      style={{ background: `${diff.color}1a`, borderLeft: `3px solid ${diff.color}` }}
    >
      {mine && (
        <span
          className="absolute -top-1.5 -right-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-extrabold leading-none shadow text-white text-outline"
          style={{ backgroundColor: mine.classColor || '#6366f1' }}
        >
          {mine.status === 'active' ? '신청함' : '대기중'}
        </span>
      )}

      {expanded && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="absolute -top-1.5 -left-1.5 z-20 w-5 h-5 rounded-md bg-base-700/95 hover:bg-base-600 text-base-200 hover:text-white text-[11px] leading-none shadow flex items-center justify-center"
          title="접기"
          aria-label="접기"
        >
          ▲
        </button>
      )}

      <div className="flex justify-center">
        {union ? (
          <GuildBadge guildName={unionGuild.badgeName || unionGuild.name} guildColor={unionGuild.color} badgeConfig={unionGuild.badge} size="xs" />
        ) : (
          <GuildBadge guildId={r.partyType} size="xs" />
        )}
      </div>

      {expanded ? (
        <>
          <div className="mt-1.5 text-center">
            <span
              className="inline-block text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: diff.color, backgroundColor: `${diff.color}26` }}
            >
              {diff.label}
            </span>
            <div className="line-clamp-3 text-[11px] sm:text-sm font-bold text-white text-outline mt-1">
              {r.title || diff.label}
            </div>
          </div>
          <div className="text-center text-[9px] sm:text-[11px] font-semibold text-base-300 mt-1">
            {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
          </div>
          {c && (
            <div className="space-y-0.5 mt-1.5">
              <CalBar label="탱" cur={c.tank} cap={caps.tank} color={ROLE_COLORS.tank} />
              <CalBar label="힐" cur={c.healer} cap={caps.healer} color={ROLE_COLORS.healer} />
              <CalBar label="딜" cur={c.dps} cap={caps.dps} color={ROLE_COLORS.dps} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-1.5 text-center">
          <div className="text-[11px] sm:text-sm font-bold text-white text-outline truncate">
            {r.title || diff.label}
          </div>
          <div className="text-[9px] sm:text-[11px] font-semibold text-base-300 mt-0.5">
            {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
          </div>
          {c && (
            <div className="flex justify-center gap-1.5 mt-0.5 text-[9px] sm:text-[11px] font-bold tabular-nums text-outline">
              <span style={{ color: ROLE_COLORS.tank }}>{c.tank}/{caps.tank}</span>
              <span style={{ color: ROLE_COLORS.healer }}>{c.healer}/{caps.healer}</span>
              <span style={{ color: ROLE_COLORS.dps }}>{c.dps}/{caps.dps}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 모바일 선택일 패널의 읽기 좋은 가로형 레이드 행.
function MobileRaidRow({ r, count: c, mine, unionGuild }) {
  const navigate = useNavigate();
  const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(r);
  const union = isUnionRaid(r.partyType);
  return (
    <button
      type="button"
      onClick={() => navigate(`/raid/${r.id}`)}
      className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition active:brightness-110"
      style={{ background: `${diff.color}14`, borderLeft: `3px solid ${diff.color}` }}
    >
      <div className="shrink-0">
        {union ? (
          <GuildBadge guildName={unionGuild.badgeName || unionGuild.name} guildColor={unionGuild.color} badgeConfig={unionGuild.badge} size="sm" />
        ) : (
          <GuildBadge guildId={r.partyType} size="sm" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ color: diff.color, backgroundColor: `${diff.color}26` }}>
            {diff.label}
          </span>
          <span className="font-bold text-white truncate">{r.title || diff.label}</span>
        </div>
        <div className="text-xs text-base-300 mt-0.5">
          {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
        </div>
        {c && (
          <div className="flex gap-2.5 mt-1 text-xs font-bold tabular-nums">
            <span style={{ color: ROLE_COLORS.tank }}>탱 {c.tank}/{caps.tank}</span>
            <span style={{ color: ROLE_COLORS.healer }}>힐 {c.healer}/{caps.healer}</span>
            <span style={{ color: ROLE_COLORS.dps }}>딜 {c.dps}/{caps.dps}</span>
          </div>
        )}
      </div>
      {mine && (
        <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white text-outline" style={{ backgroundColor: mine.classColor || '#6366f1' }}>
          {mine.status === 'active' ? '신청함' : '대기중'}
        </span>
      )}
    </button>
  );
}

// 각진 그리드 + 또렷한 구분선(갭 그리드)
const LINE = '#2b3340';
const CELL_BG = '#12161d';
const HEAD_BG = '#171c25';

export default function CalendarGrid({ raids, counts = {}, mineMap = {}, onCreate, isAdmin }) {
  const { guilds } = useApp();
  const unionGuild = getUnionGuild(guilds);
  const weeks = buildCalendarWeeks();
  const todayKey = toDateKey(new Date());

  const byDate = {};
  raids.forEach((r) => {
    (byDate[r.dateKey] = byDate[r.dateKey] || []).push(r);
  });
  Object.values(byDate).forEach((list) =>
    list.sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis())
  );

  const days = weeks.flat();

  // 모바일 선택일 — 기본 오늘, 레이드 로드되면 가장 가까운(미래) 레이드 있는 날로 1회 자동 선택.
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (autoPicked || raids.length === 0) return;
    const keys = [...new Set(raids.map((r) => r.dateKey))].sort();
    setSelectedKey(keys.find((k) => k >= todayKey) || keys[keys.length - 1] || todayKey);
    setAutoPicked(true);
  }, [raids, autoPicked, todayKey]);

  const selectedRaids = byDate[selectedKey] || [];

  return (
    <>
      {/* 모바일 전용: 달력 우측상단 일정 추가 (선택한 날짜 기준) */}
      {isAdmin && (
        <div className="sm:hidden flex justify-end mb-2">
          <button
            type="button"
            onClick={() => onCreate(selectedKey >= todayKey ? selectedKey : todayKey)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:brightness-110 text-white text-sm font-bold shadow transition"
          >
            + 일정 추가
          </button>
        </div>
      )}
      <div style={{ background: LINE, border: `1px solid ${LINE}` }}>
        <div className="grid grid-cols-7" style={{ gap: '1px', background: LINE }}>
          {/* 요일 헤더 */}
          {WEEKDAYS_KO.map((d, i) => (
            <div
              key={d}
              style={{ background: HEAD_BG }}
              className={`py-2 text-center text-sm font-bold ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-base-300'
              }`}
            >
              {d}
            </div>
          ))}

          {/* 날짜 칸 */}
          {days.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const dow = day.getDay();
            const dayRaids = byDate[key] || [];
            const isSelected = key === selectedKey;

            return (
              <div
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`relative flex flex-col px-1 py-1.5 sm:p-2.5 min-h-[58px] sm:min-h-[124px] ${
                  isSelected ? 'ring-2 ring-indigo-400 sm:ring-0' : ''
                }`}
                style={{
                  background: CELL_BG,
                  opacity: isPast ? 0.4 : 1,
                  ...(isToday ? { boxShadow: 'inset 0 0 0 2px #fbbf24' } : {}),
                }}
              >
                {/* 날짜 */}
                <div className="mb-1 sm:mb-2 sm:block text-center">
                  <span
                    className={`text-[10px] sm:text-sm font-extrabold leading-tight text-outline whitespace-nowrap sm:block ${
                      isToday
                        ? 'text-amber-300'
                        : dow === 0
                        ? 'text-red-400'
                        : dow === 6
                        ? 'text-blue-400'
                        : 'text-white'
                    }`}
                  >
                    {day.getMonth() + 1}월 {day.getDate()}일
                  </span>
                  {/* 데스크탑 전용: 칸별 레이드 추가 (모바일은 달력 상단 버튼 사용) */}
                  {isAdmin && !isPast && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onCreate(key); }}
                      className="hidden sm:flex sm:absolute sm:top-1.5 sm:right-1.5 z-10 w-5 h-5 rounded-md bg-base-700/90 hover:bg-indigo-500/60 text-base-300 hover:text-white font-bold text-xs transition leading-none items-center justify-center"
                      title="레이드 추가"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* 데스크탑: 상세 칩 스택 */}
                <div className="hidden sm:block space-y-1.5">
                  {dayRaids.map((r) => (
                    <RaidChip
                      key={r.id}
                      r={r}
                      count={counts[r.id]}
                      mine={mineMap[r.id]}
                      unionGuild={unionGuild}
                    />
                  ))}
                </div>

                {/* 모바일: 난이도 색 점만 (자세한 내용은 아래 패널에서) */}
                {dayRaids.length > 0 && (
                  <div className="sm:hidden flex flex-wrap gap-1 justify-center mt-auto">
                    {dayRaids.slice(0, 6).map((r) => {
                      const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
                      const m = mineMap[r.id];
                      return (
                        <span
                          key={r.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: diff.color, boxShadow: m ? '0 0 0 1.5px #fff' : 'none' }}
                        />
                      );
                    })}
                    {dayRaids.length > 6 && (
                      <span className="text-[8px] font-bold text-base-400 leading-none">+{dayRaids.length - 6}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 모바일 전용: 선택한 날짜의 레이드 목록 */}
      <div className="sm:hidden mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex-1 h-px bg-base-700/70" />
          <h3 className="text-sm font-bold text-base-200">{formatDateLabel(selectedKey)}</h3>
          <span className="flex-1 h-px bg-base-700/70" />
        </div>
        {selectedRaids.length === 0 ? (
          <p className="text-center text-sm text-base-500 py-6">이 날 예정된 레이드가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {selectedRaids.map((r) => (
              <MobileRaidRow
                key={r.id}
                r={r}
                count={counts[r.id]}
                mine={mineMap[r.id]}
                unionGuild={unionGuild}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
