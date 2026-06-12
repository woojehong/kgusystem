import { DIFFICULTIES } from '../lib/constants';
import { buildCalendarWeeks, toDateKey, WEEKDAYS_KO } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

/**
 * Admin 4-week calendar (starting on the Sunday of the current week).
 * Clicking an empty area of a cell opens the raid creation form;
 * clicking an existing raid chip navigates to its detail page.
 */
export default function CalendarGrid({ raids, onCreate }) {
  const navigate = useNavigate();
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
      <div className="grid grid-cols-7 border-b border-base-700">
        {WEEKDAYS_KO.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center text-xs font-bold ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-base-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={toDateKey(week[0])} className="grid grid-cols-7 border-b border-base-700 last:border-b-0">
          {week.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const dayRaids = byDate[key] || [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => !isPast && onCreate(key)}
                disabled={isPast}
                className={`relative min-h-[72px] sm:min-h-[96px] p-1 sm:p-1.5 text-left border-r border-base-700 last:border-r-0 align-top transition ${
                  isPast ? 'opacity-35 cursor-default' : 'hover:bg-base-700/40'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                    isToday ? 'bg-indigo-500 text-white' : 'text-base-300'
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-0.5 space-y-1">
                  {dayRaids.map((r) => {
                    const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
                    const s = r.startAt.toDate();
                    return (
                      <span
                        key={r.id}
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/raid/${r.id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            navigate(`/raid/${r.id}`);
                          }
                        }}
                        className="block w-full truncate text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition"
                        style={{ color: diff.color, backgroundColor: `${diff.color}1f` }}
                      >
                        {String(s.getHours()).padStart(2, '0')}:{String(s.getMinutes()).padStart(2, '0')}{' '}
                        {r.title || diff.label}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
