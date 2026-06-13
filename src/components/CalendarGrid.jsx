import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { buildCalendarWeeks, toDateKey, WEEKDAYS_KO } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

/**
 * 4-week calendar grid.
 * - Admin: shows a + button per non-past cell to open the raid creation form.
 * - All users: clicking a raid chip navigates to its detail page.
 * - Chip format: HH:MM [연합|shortName|guildName] 레이드제목
 */

function chipPrefix(partyType, guilds) {
  if (!partyType || partyType === 'union') return '연합';
  const g = guilds.find((guild) => guild.id === partyType);
  if (!g) return '';
  return g.shortName || g.name;
}

export default function CalendarGrid({ raids, onCreate, isAdmin }) {
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
        >
          {week.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const dayRaids = byDate[key] || [];

            return (
              <div
                key={key}
                className={`relative min-h-[72px] sm:min-h-[96px] p-1 sm:p-1.5 border-r border-base-700 last:border-r-0 ${
                  isPast ? 'opacity-35' : ''
                }`}
              >
                {/* Date row */}
                <div className="flex items-center justify-between">
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
                      className="w-5 h-5 rounded-md bg-base-700 hover:bg-indigo-500/50 text-base-300 hover:text-white font-bold text-xs transition leading-none"
                      title="레이드 추가"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Raid chips */}
                <div className="mt-0.5 space-y-1">
                  {dayRaids.map((r) => {
                    const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
                    const s = r.startAt.toDate();
                    const time = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
                    const prefix = chipPrefix(r.partyType, guilds);
                    return (
                      <span
                        key={r.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/raid/${r.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/raid/${r.id}`);
                        }}
                        className="block w-full truncate text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition"
                        style={{ color: diff.color, backgroundColor: `${diff.color}1f` }}
                      >
                        {time}{' '}
                        {prefix && <span className="opacity-75">[{prefix}]</span>}{' '}
                        {r.title || diff.label}
                      </span>
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
