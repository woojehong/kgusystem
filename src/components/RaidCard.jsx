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
        <p className="font-bold text-base leading-snug break-keep">
          {raid.title || `${diff.label} 공격대`}
        </p>

        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
          >
            {diff.label}
          </span>
          <span className="text-lg font-bold text-white">{formatDateLabel(raid.dateKey)}</span>
        </div>

        <p className="mt-0.5 font-semibold text-base-200">{formatTimeRange(startAt, endAt)}</p>

        <p className="mt-2 pt-2 border-t border-base-700/60 text-sm text-base-300">
          공격대장 : <span className="font-semibold text-base-100">{raid.leader}</span>
        </p>

        <div className="mt-2.5 grid grid-cols-3 gap-1 text-center">
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
