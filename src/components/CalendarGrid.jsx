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

// 각진 그리드 + 또렷한 구분선(갭 그리드)
const LINE = '#2b3340';     // 칸 사이 구분선
const CELL_BG = '#12161d';  // 날짜 칸 배경
const HEAD_BG = '#171c25';  // 요일 헤더 배경

export default function CalendarGrid({ raids, counts = {}, mineMap = {}, onCreate, isAdmin }) {
  const navigate = useNavigate();
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
                {dayRaids.map((r) => {
                  const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
                  const mine = mineMap[r.id];
                  const c = counts[r.id];
                  const caps = getCaps(r);
                  const union = isUnionRaid(r.partyType);
                  return (
                    <div
                      key={r.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/raid/${r.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/raid/${r.id}`); }}
                      className="relative cursor-pointer transition hover:brightness-125 px-2 py-2 leading-tight"
                      style={{ background: `${diff.color}1a`, borderLeft: `3px solid ${diff.color}` }}
                    >
                      {/* 신청 표시 — 우측 상단, 신청한 클래스 컬러 */}
                      {mine && (
                        <span
                          className="absolute -top-1.5 -right-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-extrabold leading-none shadow text-white text-outline"
                          style={{ backgroundColor: mine.classColor || '#6366f1' }}
                        >
                          {mine.status === 'active' ? '신청함' : '대기중'}
                        </span>
                      )}

                      {/* 1열: 뱃지 (가운데) — 길드/연합 (실시간) */}
                      <div className="flex justify-center">
                        {union ? (
                          <GuildBadge guildName={unionGuild.badgeName || unionGuild.name} guildColor={unionGuild.color} badgeConfig={unionGuild.badge} size="xs" />
                        ) : (
                          <GuildBadge guildId={r.partyType} size="xs" />
                        )}
                      </div>

                      {/* 2열: 난이도 + 제목 (제목 최대 3줄) */}
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

                      {/* 3열: 시간 범위 */}
                      <div className="text-center text-[9px] sm:text-[11px] font-semibold text-base-300 mt-1">
                        {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
                      </div>

                      {/* 4열: 탱/힐/딜 컴팩트 바 (카드뷰와 동일 형태) */}
                      {c && (
                        <div className="space-y-0.5 mt-1.5">
                          <CalBar label="탱" cur={c.tank} cap={caps.tank} color={ROLE_COLORS.tank} />
                          <CalBar label="힐" cur={c.healer} cap={caps.healer} color={ROLE_COLORS.healer} />
                          <CalBar label="딜" cur={c.dps} cap={caps.dps} color={ROLE_COLORS.dps} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
