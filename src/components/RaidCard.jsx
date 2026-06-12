import { Link } from 'react-router-dom';
import { DIFFICULTIES } from '../lib/constants';
import { formatDateLabel, formatTimeRange, getCaps, countFillColor } from '../lib/utils';

export default function RaidCard({ raid, counts }) {
  const diff = DIFFICULTIES[raid.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(raid);
  const startAt = raid.startAt.toDate();
  const endAt = raid.endAt.toDate();

  const rows = [
    ['탱커', counts?.tank ?? 0, caps.tank],
    ['힐러', counts?.healer ?? 0, caps.healer],
    ['딜러', counts?.dps ?? 0, caps.dps],
  ];

  return (
    <Link
      to={`/raid/${raid.id}`}
      className="relative block card overflow-hidden hover:border-base-600 hover:-translate-y-0.5 transition-all"
      style={{ backgroundColor: diff.soft }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />
      <div className="p-4 pl-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ color: diff.color, backgroundColor: `${diff.color}22` }}>
            {diff.label}
          </span>
          <span className="text-xs text-base-400 font-medium">{formatDateLabel(raid.dateKey)}</span>
        </div>

        <p className="mt-2 font-bold text-lg leading-tight">{formatTimeRange(startAt, endAt)}</p>
        <p className="mt-0.5 text-sm text-base-300">
          공대장 <span className="font-semibold text-base-100">{raid.leader}</span>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1 text-center">
          {rows.map(([label, cur, cap]) => (
            <div key={label} className="rounded-lg bg-base-900/50 py-1.5">
              <p className="text-[10px] text-base-400 font-medium">{label}</p>
              <p className={`text-sm font-bold ${countFillColor(cur, cap)}`}>
                {cur}/{cap}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
