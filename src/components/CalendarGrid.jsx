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
            const dayRaids = byDate[key] || [];

            return (
              <div
                key={key}
                className={`p-1 sm:p-1.5 border-r border-base-700 last:border-r-0 ${
                  isPast ? 'opacity-35' : ''
                }`}
              >
                {/* Date row */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`inline-flex items-center justify-center h-6 px-1 text-xs font-bold rounded-full ${
                      isToday ? 'bg-indigo-500 text-white px-2' : 'text-base-300'
                    }`}
                  >
                    {day.getMonth() + 1}/{day.getDate()}
                  </span>
                  {isAdmin && !isPast && (
                    <button
                      type="button"
                      onClick={() => onCreate(key)}
                      className="w-7 h-7 sm:w-5 sm:h-5 rounded-md bg-base-700 hover:bg-indigo-500/50 text-base-300 hover:text-white font-bold text-sm sm:text-xs transition leading-none flex items-center justify-center"
                      title="레이드 추가"
                    >
                      +
                    </button>
                  )}
                </div>

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
                        className={`w-full text-[10px] sm:text-xs font-semibold px-1.5 py-1.5 sm:py-1 rounded-md cursor-pointer hover:opacity-80 transition leading-tight min-h-[44px] sm:min-h-0 flex flex-col justify-center ${
                          mine ? 'ring-1 ring-indigo-400/70' : ''
                        }`}
                        style={{ color: diff.color, backgroundColor: `${diff.color}1f` }}
                      >
                        {/* 줄 1: 시간 + [bracket] (+ 내 신청 표시) */}
                        <div className="truncate opacity-80">
                          {mine && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1 align-middle"
                              title={mine === 'active' ? '신청함' : '대기중'}
                            />
                          )}
                          {time}{prefix && ` [${prefix}]`}
                        </div>
                        {/* 줄 2: 레이드 제목 */}
                        <div className="truncate font-bold mt-0.5">
                          {r.title || diff.label}
                        </div>
                        {/* 줄 3: 탱/힐/딜 카운트 */}
                        {(() => {
                          const c = counts[r.id];
                          const caps = getCaps(r);
                          if (!c) return null;
                          return (
                            <div className="flex gap-1 mt-0.5">
                              {[
                                { key: 'tank',   label: '탱', cur: c.tank,   cap: caps.tank   },
                                { key: 'healer', label: '힐', cur: c.healer, cap: caps.healer },
                                { key: 'dps',    label: '딜', cur: c.dps,    cap: caps.dps    },
                              ].map(({ key, label, cur, cap }) => (
                                <span
                                  key={key}
                                  className="text-[9px] font-bold"
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
