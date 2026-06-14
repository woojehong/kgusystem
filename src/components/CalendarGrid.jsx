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

  return (
    <div className="card overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-base-700">
        {WEEKDAYS_KO.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-sm font-bold ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-base-300'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week) => (
        <div
          key={toDateKey(week[0])}
          className="grid grid-cols-7 border-b border-base-700 last:border-b-0"
          style={{ alignItems: 'stretch' }}
        >
          {week.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const dow = day.getDay();
            const dayRaids = byDate[key] || [];

            return (
              <div
                key={key}
                className={`relative p-1 sm:p-1.5 border-r border-base-700 last:border-r-0 ${
                  isPast ? 'opacity-35' : ''
                } ${isToday ? 'bg-amber-400/10 ring-2 ring-inset ring-amber-400/70' : ''}`}
              >
                {/* Date — 가운데 정렬 */}
                <div className="text-center mb-1.5">
                  <span
                    className={`text-[11px] sm:text-sm font-extrabold leading-none text-outline ${
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
                </div>
                {isAdmin && !isPast && (
                  <button
                    type="button"
                    onClick={() => onCreate(key)}
                    className="absolute top-1 right-1 z-10 w-6 h-6 sm:w-5 sm:h-5 rounded-md bg-base-700/90 hover:bg-indigo-500/60 text-base-300 hover:text-white font-bold text-sm sm:text-xs transition leading-none flex items-center justify-center"
                    title="레이드 추가"
                  >
                    +
                  </button>
                )}

                {/* Raid chips — 2줄 레이아웃, 칸 자동 확장 */}
                <div className="space-y-1">
                  {dayRaids.map((r) => {
                    const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
                    const s = r.startAt.toDate();
                    const time = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
                    const prefix = chipPrefix(r.partyType, guilds);
                    const mine = mineMap[r.id];
                    return (
                      <div
                        key={r.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/raid/${r.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/raid/${r.id}`); }}
                        className="relative w-full text-[10px] sm:text-xs font-semibold px-1.5 py-1.5 sm:py-1 rounded-md cursor-pointer hover:opacity-80 transition leading-tight min-h-[44px] sm:min-h-0 flex flex-col justify-center"
                        style={{
                          color: diff.color,
                          backgroundColor: `${diff.color}1f`,
                          // 미신청: 같은 색 옅게 / 신청: 같은 색 진하게
                          border: `1.5px solid ${mine ? diff.color : `${diff.color}22`}`,
                        }}
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
                        {/* 줄 1: 시간 + [bracket] */}
                        <div className="truncate opacity-90 text-[11px] sm:text-sm text-outline">
                          {time}{prefix && ` [${prefix}]`}
                        </div>
                        {/* 줄 2: 레이드 제목 */}
                        <div className="truncate font-bold mt-0.5 text-[11px] sm:text-sm text-outline">
                          {r.title || diff.label}
                        </div>
                        {/* 줄 3: 탱/힐/딜 카운트 */}
                        {(() => {
                          const c = counts[r.id];
                          const caps = getCaps(r);
                          if (!c) return null;
                          return (
                            <div className="flex gap-1 mt-0.5 justify-center">
                              {[
                                { key: 'tank',   label: '탱', cur: c.tank,   cap: caps.tank   },
                                { key: 'healer', label: '힐', cur: c.healer, cap: caps.healer },
                                { key: 'dps',    label: '딜', cur: c.dps,    cap: caps.dps    },
                              ].map(({ key, label, cur, cap }) => (
                                <span
                                  key={key}
                                  className="text-[9px] font-bold text-outline"
                                  style={{ color: ROLE_COLORS[key] }}
                                >
                                  {label} {cur}/{cap}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
