import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import { formatTimeRange, getCaps, countFillColor } from '../lib/utils';

const ROLE_COLORS_CARD = { '탱커': '#38bdf8', '힐러': '#34d399', '딜러': '#fb7185' };

/** Returns the display label for a raid's party type. */
function partyTypeLabel(partyType, guilds) {
  if (!partyType || partyType === 'union') return '연합 길드 레이드';
  const g = guilds.find((guild) => guild.id === partyType);
  return g ? `${g.name} 길드 레이드` : '길드 레이드';
}

/** Short date string: 6/19 (금) */
function shortDate(dateKey) {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(Number(dateKey.split('-')[0]), m - 1, d);
  return `${m}/${d} (${weekdays[date.getDay()]})`;
}

export default function RaidCard({ raid, counts }) {
  const { guilds } = useApp();
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
        {/* Category */}
        <p className="text-xs font-bold tracking-wide text-base-400 uppercase mb-1">
          {partyTypeLabel(raid.partyType, guilds)}
        </p>

        {/* Title */}
        <p className="font-bold text-base leading-snug break-keep">
          {raid.title || `${diff.label} 공격대`}
        </p>

        {/* Difficulty + Date (same weight/size) */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
          >
            {diff.label}
          </span>
          <span className="text-sm font-bold text-white">{shortDate(raid.dateKey)}</span>
        </div>

        {/* Time */}
        <p className="mt-1 text-sm font-semibold text-base-200">
          {formatTimeRange(startAt, endAt)}
        </p>

        {/* Leader */}
        <p className="mt-2 pt-2 border-t border-base-700/60 text-sm text-base-300">
          공격대장 : <span className="font-semibold text-base-100">{raid.leader}</span>
        </p>

        {/* Headcounts */}
        <div className="mt-2.5 grid grid-cols-3 gap-1 text-center">
          {rows.map(([label, cur, cap]) => (
            <div key={label} className="rounded-lg bg-base-900/50 py-1.5">
              <p className="text-[10px] font-semibold" style={{ color: ROLE_COLORS_CARD[label] || '#94a3b8' }}>{label}</p>
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
