import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { buildCalendarWeeks, toDateKey, WEEKDAYS_KO, getCaps, formatTimeRange, getUnionGuild } from '../lib/utils';
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

// 달력 칩 — 접힘(기본)/펼침 2단계.
//  · 접힘: 신청표시 + 길드/연합 뱃지 + 제목 1줄(…). 난이도는 색으로만 구분.
//  · 펼침: 기존 상세 미리보기(난이도 pill + 제목 3줄 + 시간 + 탱힐딜 바) 그대로.
//  · 접힘 카드를 누르면 펼쳐지고, 펼친 카드는 본문을 누르면 상세페이지로 이동,
//    좌측 상단 ▲(신청표시와 겹치지 않음) 버튼으로만 다시 접는다.
//  · 펼침 상태는 컴포넌트 로컬 상태라 새로고침하면 전부 다시 접힌다.
function RaidChip({ r, count: c, mine, unionGuild }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(r);
  const union = isUnionRaid(r.partyType);
  const go = () => navigate(`/raid/${r.id}`);
  const handleClick = () => (expanded ? go() : setExpanded(true));

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      className="relative cursor-pointer transition hover:brightness-125 px-2 py-2 leading-tight"
      style={{ background: `${diff.color}1a`, borderLeft: `3px solid ${diff.color}` }}
    >
      {/* 신청 표시 — 우측 상단 (두 상태 공통) */}
      {mine && (
        <span
          className="absolute -top-1.5 -right-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-extrabold leading-none shadow text-white text-outline"
          style={{ backgroundColor: mine.classColor || '#6366f1' }}
        >
          {mine.status === 'active' ? '신청함' : '대기중'}
        </span>
      )}

      {/* 접기 버튼 — 펼친 상태에서만, 좌측 상단(신청표시와 겹치지 않음) */}
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

      {/* 뱃지 (가운데) — 길드/연합, 실시간 (두 상태 공통) */}
      <div className="flex justify-center">
        {union ? (
          <GuildBadge guildName={unionGuild.badgeName || unionGuild.name} guildColor={unionGuild.color} badgeConfig={unionGuild.badge} size="xs" />
        ) : (
          <GuildBadge guildId={r.partyType} size="xs" />
        )}
      </div>

      {expanded ? (
        <>
          {/* 난이도 + 제목 (최대 3줄) */}
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

          {/* 시간 범위 */}
          <div className="text-center text-[9px] sm:text-[11px] font-semibold text-base-300 mt-1">
            {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
          </div>

          {/* 탱/힐/딜 컴팩트 바 */}
          {c && (
            <div className="space-y-0.5 mt-1.5">
              <CalBar label="탱" cur={c.tank} cap={caps.tank} color={ROLE_COLORS.tank} />
              <CalBar label="힐" cur={c.healer} cap={caps.healer} color={ROLE_COLORS.healer} />
              <CalBar label="딜" cur={c.dps} cap={caps.dps} color={ROLE_COLORS.dps} />
            </div>
          )}
        </>
      ) : (
        /* 접힘: 제목 1줄 + 시간 + 탱힐딜 간략(역할 색) */
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

// 각진 그리드 + 또렷한 구분선(갭 그리드)
const LINE = '#2b3340';     // 칸 사이 구분선
const CELL_BG = '#12161d';  // 날짜 칸 배경
const HEAD_BG = '#171c25';  // 요일 헤더 배경

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

  return (
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

          return (
            <div
              key={key}
              className="relative flex flex-col p-2 sm:p-2.5 min-h-[88px] sm:min-h-[124px]"
              style={{
                background: CELL_BG,
                opacity: isPast ? 0.4 : 1,
                ...(isToday ? { boxShadow: 'inset 0 0 0 2px #fbbf24' } : {}),
              }}
            >
              {/* 날짜 — 모바일: 왼쪽+버튼 인라인 / 데스크탑: 가운데+버튼 절대배치 */}
              <div className="flex items-center justify-between gap-1 mb-2 sm:block">
                <span
                  className={`text-[10px] sm:text-sm font-extrabold leading-tight text-outline break-keep min-w-0 sm:block sm:text-center ${
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
                {isAdmin && !isPast && (
                  <button
                    type="button"
                    onClick={() => onCreate(key)}
                    className="shrink-0 w-6 h-6 sm:w-5 sm:h-5 sm:absolute sm:top-1.5 sm:right-1.5 z-10 rounded-md bg-base-700/90 hover:bg-indigo-500/60 text-base-300 hover:text-white font-bold text-sm sm:text-xs transition leading-none flex items-center justify-center"
                    title="레이드 추가"
                  >
                    +
                  </button>
                )}
              </div>

              {/* 레이드 칩 — 세로 스택, 하루 다건이면 칸 자동 확장 */}
              <div className="space-y-1.5">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
