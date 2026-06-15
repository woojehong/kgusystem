import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { buildCalendarWeeks, toDateKey, WEEKDAYS_KO, getCaps } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

function chipPrefix(partyType, guilds) {
  if (!partyType || partyType === 'union') return '연합';
  const g = guilds.find((guild) => guild.id === partyType);
  if (!g) return '';
  return g.shortName || g.name;
}

const ROLE_COLORS = { tank: '#38bdf8', healer: '#34d399', dps: '#fb7185' };

// 각진 그리드 + 또렷한 구분선(갭 그리드)
const LINE = '#2b3340';     // 칸 사이 구분선
const CELL_BG = '#12161d';  // 날짜 칸 배경
const HEAD_BG = '#171c25';  // 요일 헤더 배경

export default function CalendarGrid({ raids, counts = {}, mineMap = {}, onCreate, isAdmin }) {
  const navigate = useNavigate();
  const { guilds } = useApp();
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
                  const s = r.startAt.toDate();
                  const time = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
                  const prefix = chipPrefix(r.partyType, guilds);
                  const mine = mineMap[r.id];
                  const c = counts[r.id];
                  const caps = getCaps(r);
                  return (
                    <div
                      key={r.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/raid/${r.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/raid/${r.id}`); }}
                      className="relative cursor-pointer transition hover:brightness-125 px-2 py-1.5 leading-tight"
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
                      {/* 줄 1: 시간 · [약식] */}
                      <div className="truncate text-[11px] sm:text-xs font-semibold text-outline" style={{ color: diff.color }}>
                        {time}{prefix ? ` · [${prefix}]` : ''}
                      </div>
                      {/* 줄 2: 제목 (최대 2줄, 넘으면 …) */}
                      <div className="line-clamp-2 text-[11px] sm:text-sm font-bold text-white text-outline mt-0.5">
                        {r.title || diff.label}
                      </div>
                      {/* 줄 3: 탱/힐/딜 */}
                      {c && (
                        <div className="flex items-center justify-center gap-1.5 mt-1.5 tabular-nums">
                          {[
                            { k: 'tank', label: '탱', cur: c.tank, cap: caps.tank },
                            { k: 'healer', label: '힐', cur: c.healer, cap: caps.healer },
                            { k: 'dps', label: '딜', cur: c.dps, cap: caps.dps },
                          ].map(({ k, label, cur, cap }) => (
                            <span
                              key={k}
                              className="text-[9px] font-bold leading-none whitespace-nowrap text-outline"
                              style={{ color: ROLE_COLORS[k] }}
                            >
                              {label} {cur}/{cap}
                            </span>
                          ))}
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
