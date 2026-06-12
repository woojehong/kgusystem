import { badgeTextStyle } from '../lib/utils';

/**
 * Compact swap candidate panel, derived from applicants who turned the
 * swap toggle on. Classified by the roles of their other registered specs.
 */
export default function SwapList({ apps }) {
  const candidates = apps.filter((a) => a.swap && !a.isReservation);

  const groups = [
    {
      key: 'dpsCapableHealers',
      label: '딜스왑 가능 힐러',
      list: candidates.filter((a) => a.role === 'healer' && (a.swapRoles || []).includes('dps')),
    },
    {
      key: 'healCapableDps',
      label: '힐스왑 가능 딜러',
      list: candidates.filter((a) => a.role === 'dps' && (a.swapRoles || []).includes('healer')),
    },
    {
      key: 'tankCapable',
      label: '탱스왑 가능자',
      list: candidates.filter((a) => a.role !== 'tank' && (a.swapRoles || []).includes('tank')),
    },
  ];

  return (
    <div className="card p-2.5">
      <p className="text-[11px] font-bold text-base-400 mb-1.5 px-0.5">스왑 가능자</p>
      <div className="space-y-1.5">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-base-300 mr-0.5">{g.label}</span>
            {g.list.length === 0 ? (
              <span className="text-[10px] text-base-400">없음</span>
            ) : (
              g.list.map((a) => (
                <span
                  key={a.id}
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-base-850 border border-base-700"
                  style={badgeTextStyle(a.classColor)}
                  title={`${a.className} | ${a.specName}`}
                >
                  {a.charName}
                </span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
